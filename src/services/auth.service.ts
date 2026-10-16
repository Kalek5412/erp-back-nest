import { Injectable, UnauthorizedException, Logger, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from '../dto/login/login.dto';
import { User } from '../entity/user/user.entity';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,

  ) {}

  async findOneByCode(usuCodigo: string): Promise<User | null> {
    try {
      this.logger.log(`Buscando usuario: ${usuCodigo}`);
      const user = await this.userRepository.findOne({
        where: {
          usuCodigo
        },
      });
      this.logger.log(`Usuario encontrado: ${user ? 'Sí' : 'No'}`);
      return user;
    } catch (error) {
      this.logger.error(`Error al buscar usuario ${usuCodigo}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateUser(usuCodigo: string, password: string): Promise<User | null> {
    try {
      this.logger.log(`Validando usuario: ${usuCodigo}`);
      const user = await this.findOneByCode(usuCodigo);
      
      if (!user) {
        this.logger.warn(`Usuario no encontrado: ${usuCodigo}`);
        return null;
      }

      this.logger.log(`Usuario encontrado, validando contraseña para: ${usuCodigo}`);
      // Compare passwords directly since they're stored in plain text
      // Note: In production, you should implement proper password hashing
      if (user.usuPassword === password) {
        this.logger.log(`Usuario autenticado exitosamente: ${usuCodigo}`);
        return user;
      }

      this.logger.warn(`Contraseña inválida para usuario: ${usuCodigo}`);
      return null;
    } catch (error) {
      this.logger.error(`Error al validar usuario ${usuCodigo}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string; user: Partial<User> }> {
    try {
      this.logger.log(`Iniciando proceso de login para usuario: ${loginDto.usuCodigo}`);
      
      // Validar que los campos requeridos estén presentes
      if (!loginDto.usuCodigo || !loginDto.usuPassword) {
        this.logger.error('Campos requeridos faltantes en loginDto');
        throw new UnauthorizedException('Usuario y contraseña son requeridos');
      }

      const user = await this.validateUser(
        loginDto.usuCodigo,
        loginDto.usuPassword
      );

      if (!user) {
        this.logger.warn(`Login fallido para usuario: ${loginDto.usuCodigo}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      this.logger.log(`Usuario validado exitosamente: ${loginDto.usuCodigo}`);

      // Normalizar empresa del DTO (si viene) y validar autorización por empresa
      const normalize = (val?: string) => (val ?? '').toString().trim().padStart(3, '0');
      const requestedEmpresa = normalize(loginDto.usuEmpresa);

      let effectiveUserRow: User = user; // fila a usar para firmar token y responder

      if (requestedEmpresa) {
        // Buscar exactamente la fila USUARIO para (USU_CODIGO, EMP_CODIGO)
        const match = await this.userRepository.findOne({
          where: { usuCodigo: user.usuCodigo, usuEmpresa: requestedEmpresa },
        });
        if (!match) {
          this.logger.warn(`Login denegado: usuario ${user.usuCodigo} intentó entrar a empresa ${requestedEmpresa} sin autorización`);
          throw new ForbiddenException('No autorizado para la empresa seleccionada');
        }
        effectiveUserRow = match;
      }

      const usuEmpresa = requestedEmpresa || normalize(user.usuEmpresa);
      this.logger.log(`Usando empresa: ${usuEmpresa}`);

      const payload = {
        sub: effectiveUserRow.usuCodigo,
        empresa: usuEmpresa,
        nivel: effectiveUserRow.usuNivel,
        nombre: effectiveUserRow.usuNombre,
      };

      this.logger.log(`Generando JWT token para usuario: ${effectiveUserRow.usuCodigo}`);
      const access_token = this.jwtService.sign(payload);

      // Return user info without password, usando la fila efectiva (match o user original)
      const { usuPassword, ...userSafeData } = effectiveUserRow as any;
      const responseUser = {
        ...userSafeData,
        usuEmpresa: usuEmpresa,
      };

      this.logger.log(`Login exitoso para usuario: ${loginDto.usuCodigo}`);
      return {
        access_token,
        user: responseUser,
      };
    } catch (error) {
      this.logger.error(`Error durante el login para usuario ${loginDto.usuCodigo}: ${error.message}`, error.stack);
      
      // Si es un UnauthorizedException, lo relanzamos tal como está
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Para otros errores, lanzamos un error genérico del servidor
      throw new UnauthorizedException('Error interno del servidor durante la autenticación');
    }
  }

  async switchCompany(usuCodigo: string, companyCode: string): Promise<{ access_token: string; user: Partial<User> }> {
    try {
      this.logger.log(`Iniciando cambio de empresa para: ${usuCodigo} a la empresa ${companyCode}`);
      // Buscar TODAS las filas del usuario (modelo multi-empresa: múltiples filas en USUARIO)
      const users = await this.userRepository.find({ where: { usuCodigo } });
      if (!users || users.length === 0) {
        this.logger.warn(`Cambio de empresa fallido, usuario no encontrado: ${usuCodigo}`);
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const normalize = (val?: string) => (val ?? '').toString().trim().padStart(3, '0');
      const requested = normalize(companyCode);
      if (!requested) {
        throw new UnauthorizedException('Código de empresa inválido');
      }

      // ¿El usuario tiene alguna fila con EMP_CODIGO = requested?
      const match = users.find(u => normalize((u as any).usuEmpresa ?? (u as any).EMP_CODIGO ?? (u as any).COD_EMPRESA) === requested);
      if (!match) {
        this.logger.warn(`Usuario ${usuCodigo} intentó cambiar a empresa ${requested} sin permiso (no hay fila asociada)`);
        throw new ForbiddenException('No autorizado a la empresa solicitada');
      }

      this.logger.log(`Usuario autorizado. Generando nuevo token con empresa: ${requested}`);

      const payload = {
        sub: match.usuCodigo,
        empresa: requested, // Use normalized company code
        nivel: match.usuNivel,
        nombre: match.usuNombre,
      };

      const access_token = this.jwtService.sign(payload);

      // Return user info without password, using the new companyCode
      const { usuPassword, ...userSafeData } = match as any;
      const responseUser = {
        ...userSafeData,
        usuEmpresa: requested, // Ensure the new company is in the response
      };

      this.logger.log(`Cambio de empresa exitoso para: ${usuCodigo}`);
      return {
        access_token,
        user: responseUser,
      };
    } catch (error) {
      this.logger.error(`Error durante el cambio de empresa para ${usuCodigo}: ${error.message}`, error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Error interno del servidor durante el cambio de empresa');
    }
  }

  async hasAccessToCompany(usuCodigo: string, companyCode: string): Promise<boolean> {
    const normalize = (val?: string) => (val ?? '').toString().trim().padStart(3, '0');
    const requested = normalize(companyCode);
    if (!requested) return false;
    // Buscar todas las filas del usuario y validar si alguna coincide
    const users = await this.userRepository.find({ where: { usuCodigo } });
    if (!users || users.length === 0) return false;
    return users.some(u => normalize((u as any).usuEmpresa ?? (u as any).EMP_CODIGO ?? (u as any).COD_EMPRESA) === requested);
  }
}