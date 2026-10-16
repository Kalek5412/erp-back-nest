import { Module } from '@nestjs/common';
import { AuthService } from '../../services/auth.service';
import { AuthController } from '../../controller/auth/auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entity/user/user.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // --- CAMBIO IMPORTANTE ---
    // Usamos register en lugar de registerAsync para poner la clave directamente.
    JwtModule.register({
      secret: 'ESTA_ES_UNA_CLAVE_DE_PRUEBA_TEMPORAL_12345', // Clave secreta hardcoded
      signOptions: { expiresIn: '3600s' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}