import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { InventariosService } from 'src/services/inventarios/inventarios.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { AuthService } from 'src/services/auth.service';

@Controller('inventarios')
export class InventariosController {
  constructor(
    private readonly inventariosService: InventariosService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getInventario(@Req() req, @Query('company') company?: string) {
    console.log('User from token:', req.user);
    const normalize = (val?: string) => (val ?? '').toString().trim().padStart(3, '0');
    const tokenCompany = normalize(req.user?.usuEmpresa);
    const requestedCompany = normalize(company);

    let effectiveCompany = tokenCompany;
    if (requestedCompany && requestedCompany !== tokenCompany) {
      const hasAccess = await this.authService.hasAccessToCompany(req.user?.usuCodigo, requestedCompany);
      console.log(`Requested company override: ${requestedCompany}, hasAccess=${hasAccess}`);
      if (hasAccess) {
        effectiveCompany = requestedCompany;
      }
    }

    console.log(`Inventarios effectiveCompany: ${effectiveCompany}`);
    return this.inventariosService.getInventario(effectiveCompany);
  }
}