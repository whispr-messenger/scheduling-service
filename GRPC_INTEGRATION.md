# Guide d'Intégration gRPC - Whispr Messenger

Ce document explique comment implémenter la communication gRPC entre le **scheduling-service** (NestJS) et le **messaging-service** (Elixir/Phoenix).

## Architecture

```
┌─────────────────────────┐         gRPC          ┌─────────────────────────┐
│  Scheduling Service     │◄─────────────────────►│  Messaging Service      │
│  (NestJS/TypeScript)    │                        │  (Elixir/Phoenix)       │
│  Port 3000 (HTTP)       │                        │  Port 4000 (HTTP)       │
│  Port 3001 (gRPC)       │                        │  Port 4001 (gRPC)       │
└─────────────────────────┘                        └─────────────────────────┘
         │                                                    │
         │ Appelle sendNotification()                        │
         │ quand un job s'exécute                            │
         │                                                    │
         │                                                    │ Appelle scheduleJob()
         │                                                    │ pour programmer un message
         └────────────────────────────────────────────────────┘
```

## Fichiers Proto

Les fichiers proto sont partagés et doivent être identiques dans les deux services.

### Location des fichiers proto

**Scheduling Service:**
- `src/modules/grpc/proto/scheduler.proto`
- `src/modules/grpc/proto/messaging.proto`

**Messaging Service (à créer):**
- `priv/protos/scheduler.proto` (copie)
- `priv/protos/messaging.proto` (copie)

## Implémentation côté Messaging Service (Elixir)

### 1. Dépendances

Ajoutez dans `mix.exs` :

```elixir
defp deps do
  [
    # Existant
    {:phoenix, "~> 1.7"},
    {:ecto, "~> 3.10"},

    # Pour gRPC
    {:grpc, "~> 0.7"},
    {:cowboy, "~> 2.10"},
    {:protobuf, "~> 0.12"},
    {:google_protos, "~> 0.3"}
  ]
end
```

### 2. Générer le code Elixir depuis les protos

```bash
# Installer protoc si pas déjà fait
# macOS: brew install protobuf
# Linux: apt-get install protobuf-compiler

# Copier les fichiers proto depuis scheduling-service
cp ../scheduling-service/src/modules/grpc/proto/*.proto priv/protos/

# Générer le code Elixir
mix protobuf.generate \
  --output-path=./lib/whispr_messaging_web/grpc/generated \
  --include-path=priv/protos \
  priv/protos/messaging.proto \
  priv/protos/scheduler.proto
```

### 3. Implémenter le Server gRPC (MessagingService)

Créez `lib/whispr_messaging_web/grpc/messaging_server.ex` :

```elixir
defmodule WhisprMessagingWeb.Grpc.MessagingServer do
  @moduledoc """
  Implémentation du serveur gRPC pour MessagingService
  """

  use GRPC.Server, service: Whispr.Messaging.MessagingService.Service

  require Logger

  alias WhisprMessaging.Messages
  alias WhisprMessaging.Notifications

  @doc """
  Envoie une notification (appelé par scheduling-service)
  """
  @spec send_notification(Whispr.Messaging.SendNotificationRequest.t(), GRPC.Server.Stream.t())
    :: Whispr.Messaging.SendNotificationResponse.t()
  def send_notification(request, _stream) do
    Logger.info("gRPC SendNotification called",
      user_id: request.user_id,
      conversation_id: request.conversation_id
    )

    case Notifications.send_notification(%{
      user_id: request.user_id,
      message: request.message,
      conversation_id: request.conversation_id,
      type: parse_notification_type(request.type),
      metadata: request.metadata || %{}
    }) do
      {:ok, notification} ->
        Whispr.Messaging.SendNotificationResponse.new(
          notification_id: notification.id,
          status: "sent",
          sent_at: Google.Protobuf.Timestamp.new(seconds: DateTime.to_unix(DateTime.utc_now())),
          error_message: nil
        )

      {:error, reason} ->
        Logger.error("Failed to send notification", error: inspect(reason))
        Whispr.Messaging.SendNotificationResponse.new(
          notification_id: "",
          status: "failed",
          sent_at: Google.Protobuf.Timestamp.new(seconds: DateTime.to_unix(DateTime.utc_now())),
          error_message: to_string(reason)
        )
    end
  end

  @doc """
  Envoie un message programmé
  """
  @spec send_scheduled_message(Whispr.Messaging.SendScheduledMessageRequest.t(), GRPC.Server.Stream.t())
    :: Whispr.Messaging.SendMessageResponse.t()
  def send_scheduled_message(request, _stream) do
    Logger.info("gRPC SendScheduledMessage called",
      conversation_id: request.conversation_id,
      sender_id: request.sender_id
    )

    case Messages.send_message(%{
      conversation_id: request.conversation_id,
      sender_id: request.sender_id,
      message_type: parse_message_type(request.message_type),
      content: request.content,
      metadata: Map.merge(request.metadata || %{}, %{"scheduled" => true})
    }) do
      {:ok, message} ->
        Whispr.Messaging.SendMessageResponse.new(
          message_id: message.id,
          status: "sent",
          sent_at: Google.Protobuf.Timestamp.new(seconds: DateTime.to_unix(DateTime.utc_now()))
        )

      {:error, reason} ->
        Logger.error("Failed to send scheduled message", error: inspect(reason))
        raise GRPC.RPCError, status: :internal, message: to_string(reason)
    end
  end

  @doc """
  Nettoie les messages expirés
  """
  @spec cleanup_expired_messages(Whispr.Messaging.CleanupRequest.t(), GRPC.Server.Stream.t())
    :: Whispr.Messaging.CleanupResponse.t()
  def cleanup_expired_messages(request, _stream) do
    Logger.info("gRPC CleanupExpiredMessages called")

    older_than = timestamp_to_datetime(request.older_than)
    batch_size = request.batch_size || 100

    case Messages.cleanup_expired(older_than, batch_size) do
      {:ok, count} ->
        Whispr.Messaging.CleanupResponse.new(
          deleted_count: count,
          processed_at: Google.Protobuf.Timestamp.new(seconds: DateTime.to_unix(DateTime.utc_now()))
        )

      {:error, reason} ->
        Logger.error("Failed to cleanup expired messages", error: inspect(reason))
        raise GRPC.RPCError, status: :internal, message: to_string(reason)
    end
  end

  @doc """
  Health check
  """
  @spec health_check(Google.Protobuf.Empty.t(), GRPC.Server.Stream.t())
    :: Whispr.Messaging.HealthResponse.t()
  def health_check(_request, _stream) do
    Whispr.Messaging.HealthResponse.new(
      status: "healthy",
      message: "Messaging service is running",
      timestamp: Google.Protobuf.Timestamp.new(seconds: DateTime.to_unix(DateTime.utc_now()))
    )
  end

  # Helpers

  defp parse_notification_type(type) do
    case type do
      :NOTIFICATION_TYPE_UNSPECIFIED -> :message
      :MESSAGE -> :message
      :REMINDER -> :reminder
      :SYSTEM_ALERT -> :system_alert
      :SCHEDULED_MESSAGE -> :scheduled_message
      _ -> :message
    end
  end

  defp parse_message_type(type) do
    case type do
      :MESSAGE_TYPE_UNSPECIFIED -> :text
      :TEXT -> :text
      :IMAGE -> :image
      :VIDEO -> :video
      :AUDIO -> :audio
      :FILE -> :file
      :SYSTEM -> :system
      _ -> :text
    end
  end

  defp timestamp_to_datetime(%{seconds: seconds}) do
    DateTime.from_unix!(seconds)
  end
  defp timestamp_to_datetime(_), do: DateTime.utc_now()
end
```

### 4. Implémenter le Client gRPC (SchedulerService)

Créez `lib/whispr_messaging_web/grpc/scheduler_client.ex` :

```elixir
defmodule WhisprMessagingWeb.Grpc.SchedulerClient do
  @moduledoc """
  Client gRPC pour communiquer avec le Scheduling Service
  """

  require Logger

  alias Whispr.Scheduler.{
    SchedulerService.Stub,
    CreateJobRequest,
    ScheduleJobRequest,
    ScheduleType
  }

  @doc """
  Crée et planifie un message pour plus tard
  """
  def schedule_message(params) do
    with {:ok, channel} <- get_channel(),
         {:ok, job} <- create_message_job(channel, params),
         {:ok, schedule} <- schedule_job(channel, job.id, params.scheduled_at) do
      {:ok, %{job: job, schedule: schedule}}
    else
      {:error, reason} ->
        Logger.error("Failed to schedule message via gRPC", error: inspect(reason))
        {:error, reason}
    end
  end

  @doc """
  Crée un job de nettoyage récurrent
  """
  def create_cleanup_job do
    with {:ok, channel} <- get_channel(),
         {:ok, job} <- create_cleanup_job(channel),
         {:ok, schedule} <- schedule_recurring_job(channel, job.id, "0 2 * * *") do
      {:ok, %{job: job, schedule: schedule}}
    end
  end

  # Private functions

  defp get_channel do
    host = Application.get_env(:whispr_messaging, :scheduling_service_host, "localhost")
    port = Application.get_env(:whispr_messaging, :scheduling_service_port, 3001)

    case GRPC.Stub.connect("#{host}:#{port}") do
      {:ok, channel} -> {:ok, channel}
      {:error, reason} ->
        Logger.error("Failed to connect to scheduling service",
          host: host, port: port, error: inspect(reason))
        {:error, :connection_failed}
    end
  end

  defp create_message_job(channel, params) do
    request = CreateJobRequest.new(
      name: "Scheduled Message: #{params.conversation_id}",
      description: "Send scheduled message",
      category_id: get_messaging_category_id(),
      target_service: "messaging",
      target_method: "sendScheduledMessage",
      payload: Jason.encode!(%{
        conversation_id: params.conversation_id,
        sender_id: params.sender_id,
        message_type: 1, # TEXT
        content: params.content,
        metadata: params.metadata || %{}
      }),
      priority: :HIGH,
      max_retries: 3,
      timeout_seconds: 30,
      created_by: params.sender_id
    )

    case Stub.create_job(channel, request) do
      {:ok, response} -> {:ok, response}
      {:error, error} ->
        Logger.error("Failed to create job", error: inspect(error))
        {:error, :job_creation_failed}
    end
  end

  defp create_cleanup_job(channel) do
    request = CreateJobRequest.new(
      name: "Daily Message Cleanup",
      description: "Clean up expired messages",
      category_id: get_maintenance_category_id(),
      target_service: "messaging",
      target_method: "cleanupExpiredMessages",
      payload: Jason.encode!(%{
        older_than: DateTime.utc_now() |> DateTime.add(-30, :day) |> DateTime.to_iso8601(),
        batch_size: 100
      }),
      priority: :LOW,
      max_retries: 2,
      timeout_seconds: 300,
      created_by: "system"
    )

    Stub.create_job(channel, request)
  end

  defp schedule_job(channel, job_id, scheduled_at) do
    request = ScheduleJobRequest.new(
      job_id: job_id,
      schedule_type: :ONCE,
      scheduled_at: datetime_to_timestamp(scheduled_at),
      timezone: "UTC"
    )

    Stub.schedule_job(channel, request)
  end

  defp schedule_recurring_job(channel, job_id, cron_expression) do
    request = ScheduleJobRequest.new(
      job_id: job_id,
      schedule_type: :CRON,
      cron_expression: cron_expression,
      timezone: "UTC"
    )

    Stub.schedule_job(channel, request)
  end

  defp datetime_to_timestamp(datetime) do
    Google.Protobuf.Timestamp.new(
      seconds: DateTime.to_unix(datetime)
    )
  end

  # Ces IDs doivent correspondre aux catégories créées dans la base de données
  defp get_messaging_category_id, do: Application.get_env(:whispr_messaging, :messaging_category_id)
  defp get_maintenance_category_id, do: Application.get_env(:whispr_messaging, :maintenance_category_id)
end
```

### 5. Configuration du Endpoint gRPC

Dans `lib/whispr_messaging_web/endpoint.ex`, ajoutez :

```elixir
defmodule WhisprMessagingWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :whispr_messaging

  # ... configuration Phoenix existante ...

  # Configuration gRPC
  plug GRPC.Server.Adapters.Cowboy.Handler,
    service_handlers: [WhisprMessagingWeb.Grpc.MessagingServer]
end
```

### 6. Configuration dans config/config.exs

```elixir
# Configuration gRPC
config :grpc, start_server: true

config :whispr_messaging, WhisprMessagingWeb.Endpoint,
  grpc: [
    port: 4001
  ]

# Scheduling service connection
config :whispr_messaging,
  scheduling_service_host: System.get_env("SCHEDULING_SERVICE_HOST") || "localhost",
  scheduling_service_port: String.to_integer(System.get_env("SCHEDULING_SERVICE_PORT") || "3001"),
  messaging_category_id: System.get_env("MESSAGING_CATEGORY_ID"),
  maintenance_category_id: System.get_env("MAINTENANCE_CATEGORY_ID")
```

### 7. Variables d'Environnement (.env)

```bash
# gRPC Configuration
GRPC_PORT=4001
SCHEDULING_SERVICE_HOST=localhost
SCHEDULING_SERVICE_PORT=3001

# Job Category IDs (obtenir depuis la base scheduling-service)
MESSAGING_CATEGORY_ID=cat-messaging-uuid
MAINTENANCE_CATEGORY_ID=cat-maintenance-uuid
```

## Test de l'Intégration

### 1. Démarrer les deux services

```bash
# Terminal 1 - Scheduling Service
cd scheduling-service
npm run start:dev

# Terminal 2 - Messaging Service
cd messaging-service
mix phx.server
```

### 2. Tester avec grpcurl

```bash
# Test du messaging service
grpcurl -plaintext localhost:4001 list
grpcurl -plaintext localhost:4001 whispr.messaging.MessagingService/HealthCheck

# Test du scheduling service
grpcurl -plaintext localhost:3001 list
grpcurl -plaintext localhost:3001 whispr.scheduler.SchedulerService/HealthCheck
```

### 3. Créer un job de notification

```bash
# Via REST API du scheduling service
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Notification",
    "categoryId": "<category-id>",
    "targetService": "messaging",
    "targetMethod": "sendNotification",
    "payload": {
      "userId": "user-123",
      "message": "Test message",
      "conversationId": "conv-456",
      "type": 1
    },
    "priority": "HIGH"
  }'
```

### 4. Programmer un message depuis Elixir

```elixir
# Dans iex -S mix
alias WhisprMessagingWeb.Grpc.SchedulerClient

# Programmer un message pour dans 1 heure
scheduled_at = DateTime.utc_now() |> DateTime.add(3600, :second)

SchedulerClient.schedule_message(%{
  conversation_id: "conv-123",
  sender_id: "user-456",
  content: "Message programmé depuis Elixir!",
  scheduled_at: scheduled_at,
  metadata: %{"source" => "web"}
})
```

## Troubleshooting

### Le service ne se connecte pas

1. Vérifiez que les deux services sont démarrés
2. Vérifiez les ports dans les variables d'environnement
3. Vérifiez les logs de connexion gRPC

### Erreur de génération proto

1. Assurez-vous que protoc est installé: `protoc --version`
2. Vérifiez que les fichiers proto sont bien copiés
3. Les imports Google protobuf doivent être disponibles

### Jobs ne s'exécutent pas

1. Vérifiez que la base de données du scheduling service contient les catégories
2. Vérifiez que Redis est démarré
3. Consultez les logs du job processor

## Sécurité en Production

Pour la production avec Istio Service Mesh :

1. Les communications gRPC sont automatiquement chiffrées avec mTLS
2. Les certificats sont gérés par SPIFFE/SPIRE
3. Les policies réseau Kubernetes restreignent le trafic
4. L'authentification mutuelle est activée

Configuration Kubernetes requise :

```yaml
apiVersion: v1
kind: Service
metadata:
  name: messaging-service
spec:
  ports:
  - port: 50052
    name: grpc
    targetPort: 4001
```

## Références

- [gRPC Elixir](https://github.com/elixir-grpc/grpc)
- [NestJS gRPC](https://docs.nestjs.com/microservices/grpc)
- [Protocol Buffers](https://protobuf.dev/)
