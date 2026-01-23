-- Création de la base de données auth_service si elle n'existe pas
CREATE DATABASE IF NOT EXISTS auth_service;

-- Utilisation de la base de données
\c auth_service;

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour les fonctions cryptographiques
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Index pour optimiser les requêtes sur les numéros de téléphone
CREATE INDEX IF NOT EXISTS idx_user_auth_phone_number ON user_auth(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_auth_created_at ON user_auth(created_at);
CREATE INDEX IF NOT EXISTS idx_user_auth_last_authenticated_at ON user_auth(last_authenticated_at);

-- Index pour optimiser les requêtes sur les appareils
CREATE INDEX IF NOT EXISTS idx_device_user_id ON device(user_id);
CREATE INDEX IF NOT EXISTS idx_device_last_active ON device(last_active);
CREATE INDEX IF NOT EXISTS idx_device_is_verified ON device(is_verified);
CREATE INDEX IF NOT EXISTS idx_device_created_at ON device(created_at);

-- Fonction pour nettoyer les anciens codes de vérification (à utiliser avec un cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Cette fonction peut être étendue pour nettoyer les données expirées
    -- Par exemple, supprimer les anciens tokens révoqués, codes de vérification expirés, etc.
    RAISE NOTICE 'Cleanup function executed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger sur les tables (sera créé automatiquement par TypeORM)
-- CREATE TRIGGER update_user_auth_updated_at BEFORE UPDATE ON user_auth FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_device_updated_at BEFORE UPDATE ON device FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();