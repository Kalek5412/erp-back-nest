import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from '../../services/auth.service';
import { LoginDto } from '../../dto/login/login.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Public } from '../../decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  getProfile(@Request() req) {
    // Use the property names set by JwtStrategy.validate()
    const usuNombreFromUser = req.user.usuNombre;
    const usuNivelFromUser = req.user.usuNivel;
    const usuEmpresaFromUser = req.user.usuEmpresa;

    return {
      usuNombre: usuNombreFromUser,
      usuNivel: usuNivelFromUser,
      usuEmpresa: usuEmpresaFromUser
    };
  }

  @Get('validate')
  validateToken(@Request() req) {
    return { 
      valid: true, 
      user: req.user 
    };
  }

  @Post('switch-company')
  async switchCompany(@Request() req, @Body() body: { companyCode: string }) {
    // JwtStrategy.validate() mapea el payload a { usuCodigo, usuEmpresa, usuNivel, usuNombre }
    const usuCodigo: string = req.user?.usuCodigo;
    const companyCode: string = body?.companyCode;
    return this.authService.switchCompany(usuCodigo, companyCode);
  }
}