import { Controller, Get, UseGuards, Req, UnauthorizedException, BadRequestException, Logger, Query, Patch, Param, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CarteraClientesService } from '../../services/cartera-clientes/cartera-clientes.service';
import { Request } from 'express';
import { UpdateVendedorDto } from '../../dto/cartera-clientes/update-vendedor.dto';

@Controller('listacartera')
@UseGuards(JwtAuthGuard)
export class CarteraClientesController {
    private readonly logger = new Logger(CarteraClientesController.name);

    constructor(private readonly carteraClientesService: CarteraClientesService) {}

    @Get()
    async getListaCartera(
        @Req() req: Request,
        @Query('cliente') cliente?: string,
        @Query('vendedor') vendedor?: string,
        @Query('fechaDesde') fechaDesde?: string,
        @Query('fechaHasta') fechaHasta?: string,
    ): Promise<any[]> {
        this.logger.debug('User requesting cartera de clientes');
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }
        try {
            return await this.carteraClientesService.getCarteraPorDocumento(usuEmpresa, cliente, vendedor, fechaDesde, fechaHasta);
        } catch (error) {
            this.logger.error(`Error in getListaCartera: ${error.message}`);
            throw new BadRequestException(`Failed to get cartera de clientes: ${error.message}`);
        }
    }

    @Patch('por-cliente/:codCli')
    async updateVendedorPorCliente(
        @Req() req: Request,
        @Param('codCli') codCli: string,
        @Body() updateVendedorDto: UpdateVendedorDto,
    ) {
        this.logger.debug(`User requesting to update vendedor for client ${codCli}`);
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }
        try {
            return await this.carteraClientesService.updateVendedorPorCliente(usuEmpresa, codCli, updateVendedorDto.cdoCodVen);
        } catch (error) {
            this.logger.error(`Error in updateVendedorPorCliente: ${error.message}`);
            throw new BadRequestException(`Failed to update vendedor for client: ${error.message}`);
        }
    }

    @Patch(':tipoDoc/:nroDoc')
    async updateVendedor(
        @Req() req: Request,
        @Param('tipoDoc') tipoDoc: string,
        @Param('nroDoc') nroDoc: string,
        @Body() updateVendedorDto: UpdateVendedorDto,
    ) {
        this.logger.debug(`User requesting to update vendedor for doc ${tipoDoc}-${nroDoc}`);
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }
        try {
            return await this.carteraClientesService.updateVendedor(usuEmpresa, tipoDoc, nroDoc, updateVendedorDto.cdoCodVen);
        } catch (error) {
            this.logger.error(`Error in updateVendedor: ${error.message}`);
            throw new BadRequestException(`Failed to update vendedor: ${error.message}`);
        }
    }
    
    @Get('vendedores')
    async getVendedores(@Req() req: Request): Promise<any[]> {
        this.logger.debug('User requesting vendor list');
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }
        try {
            return await this.carteraClientesService.getVendedores(usuEmpresa);
        } catch (error) {
            this.logger.error(`Error fetching vendedores: ${error.message}`);
            throw new BadRequestException(`Failed to get vendedores: ${error.message}`);
        }
    }

    @Get('por-cliente')
    async getCarteraPorCliente(
        @Req() req: Request,
        @Query('cliente') cliente?: string,
        @Query('vendedor') vendedor?: string
    ): Promise<any[]> {
        this.logger.debug('User requesting cartera por cliente');
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }
        try {
            return await this.carteraClientesService.getCarteraPorCliente(usuEmpresa, cliente, vendedor);
        } catch (error) {
            this.logger.error(`Error in getCarteraPorCliente: ${error.message}`);
            throw new BadRequestException(`Failed to get cartera por cliente: ${error.message}`);
        }
    }
} 