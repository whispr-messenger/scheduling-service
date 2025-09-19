import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface AuthenticatedRequest {
  user?: any;
  path: string;
  method: string;
  headers: { [key: string]: string | string[] | undefined };
  connection?: { remoteAddress?: string };
}

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system',
  SERVICE = 'service',
}

export enum Permission {
  CREATE_JOB = 'create_job',
  UPDATE_JOB = 'update_job',
  DELETE_JOB = 'delete_job',
  VIEW_JOB = 'view_job',
  EXECUTE_JOB = 'execute_job',
  CREATE_SCHEDULE = 'create_schedule',
  UPDATE_SCHEDULE = 'update_schedule',
  DELETE_SCHEDULE = 'delete_schedule',
  VIEW_SCHEDULE = 'view_schedule',
  ADMIN_OPERATIONS = 'admin_operations',
  SYSTEM_OPERATIONS = 'system_operations',
}

// Décorateurs pour les métadonnées
export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request['user'];

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Vérifier les rôles requis
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Vérifier les permissions requises
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucun rôle ni permission n'est requis, autoriser
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    try {
      // Vérifier les rôles
      if (requiredRoles && !this.hasRequiredRoles(user, requiredRoles)) {
        this.logAccessDenied(request, user, 'insufficient_roles', {
          required: requiredRoles,
          user_roles: user.roles || [],
        });
        throw new ForbiddenException('Rôles insuffisants');
      }

      // Vérifier les permissions
      if (requiredPermissions && !this.hasRequiredPermissions(user, requiredPermissions)) {
        this.logAccessDenied(request, user, 'insufficient_permissions', {
          required: requiredPermissions,
          user_permissions: user.permissions || [],
        });
        throw new ForbiddenException('Permissions insuffisantes');
      }

      this.logAccessGranted(request, user);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      this.logger.error('Error in roles guard', {
        error: error.message,
        userId: user.sub,
        path: request.path,
      });
      
      throw new ForbiddenException('Erreur de vérification des autorisations');
    }
  }

  private hasRequiredRoles(user: any, requiredRoles: Role[]): boolean {
    const userRoles = user.roles || [];
    
    // Les admins système ont tous les rôles
    if (userRoles.includes(Role.SYSTEM)) {
      return true;
    }

    // Vérifier si l'utilisateur a au moins un des rôles requis
    return requiredRoles.some(role => userRoles.includes(role));
  }

  private hasRequiredPermissions(user: any, requiredPermissions: Permission[]): boolean {
    const userPermissions = user.permissions || [];
    const userRoles = user.roles || [];

    // Les admins système ont toutes les permissions
    if (userRoles.includes(Role.SYSTEM)) {
      return true;
    }

    // Les admins ont la plupart des permissions (sauf système)
    if (userRoles.includes(Role.ADMIN)) {
      const systemOnlyPermissions = [Permission.SYSTEM_OPERATIONS];
      const hasSystemOnlyPermission = requiredPermissions.some(p => 
        systemOnlyPermissions.includes(p)
      );
      
      if (!hasSystemOnlyPermission) {
        return true;
      }
    }

    // Vérifier les permissions explicites
    return requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
  }

  private logAccessGranted(request: AuthenticatedRequest, user: any): void {
    this.logger.debug('Access granted', {
      userId: user.sub,
      roles: user.roles || [],
      permissions: user.permissions || [],
      path: request.path,
      method: request.method,
    });
  }

  private logAccessDenied(
    request: AuthenticatedRequest, 
    user: any, 
    reason: string, 
    details: any
  ): void {
    this.logger.warn('Access denied', {
      userId: user.sub,
      reason,
      details,
      path: request.path,
      method: request.method,
      userAgent: request.headers['user-agent'],
      ip: this.getClientIp(request),
    });
  }

  private getClientIp(request: AuthenticatedRequest): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      'unknown'
    );
  }
}

// Utilitaires pour vérifier les permissions dans le code
export class PermissionChecker {
  static hasRole(user: any, role: Role): boolean {
    const userRoles = user?.roles || [];
    return userRoles.includes(role) || userRoles.includes(Role.SYSTEM);
  }

  static hasPermission(user: any, permission: Permission): boolean {
    const userPermissions = user?.permissions || [];
    const userRoles = user?.roles || [];

    // Système a toutes les permissions
    if (userRoles.includes(Role.SYSTEM)) {
      return true;
    }

    // Admin a la plupart des permissions
    if (userRoles.includes(Role.ADMIN) && permission !== Permission.SYSTEM_OPERATIONS) {
      return true;
    }

    return userPermissions.includes(permission);
  }

  static hasAnyRole(user: any, roles: Role[]): boolean {
    return roles.some(role => this.hasRole(user, role));
  }

  static hasAnyPermission(user: any, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }
}