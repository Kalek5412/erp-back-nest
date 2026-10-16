import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // --- CAMBIO IMPORTANTE ---
      // Le damos la misma clave secreta que pusimos en auth.module.ts
      secretOrKey: 'ESTA_ES_UNA_CLAVE_DE_PRUEBA_TEMPORAL_12345',
    });
  }

  async validate(payload: any) {
    // Mapear el payload a la forma que esperan los controladores (req.user.usuEmpresa)
    // El token se firma en AuthService.login() con: sub, empresa, nivel, nombre
    return {
      usuCodigo: payload.sub,
      usuEmpresa: payload.empresa,
      usuNivel: payload.nivel,
      usuNombre: payload.nombre,
    };
  }
}