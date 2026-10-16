import { Controller, Get, BadRequestException, Logger, Req, Query, Res } from '@nestjs/common';
import { PedidosService } from '../../services/pedidos/pedidos.service';
import { Response } from 'express';

@Controller('pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(private readonly pedidosService: PedidosService) {}

  // Lista de pedidos (cabecera)
  @Get()
  async getPedidos(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
  ) {
    const empresa = usuEmpresa || req?.user?.usuEmpresa || 'UNE003';
    if (!empresa) throw new BadRequestException('usuEmpresa es requerido');
    return this.pedidosService.getPedidos(empresa, fechaInicio, fechaFin);
  }

  // Lista JSON de EMITIDOS (opcional)
  @Get('emitidos')
  async getPedidosEmitidos(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
  ) {
    const empresa = usuEmpresa || req?.user?.usuEmpresa || 'UNE004';
    return this.pedidosService.getPedidosEmitidos(empresa, fechaInicio, fechaFin);
  }

  // Export Excel de EMITIDOS
  @Get('emitidos/export')
  async exportPedidosEmitidosExcel(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    this.logger.debug(`Export EMITIDOS requested fi=${fechaInicio} ff=${fechaFin}`);
    try {
      const empresa = usuEmpresa || req?.user?.empresa || req?.user?.usuEmpresa || '004';
      const buffer = await this.pedidosService.exportPedidosEmitidosExcel(empresa, fechaInicio, fechaFin);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="pedidos_emitidos.xlsx"');
      return res.send(buffer);
    } catch (e: any) {
      this.logger.error(`Export EMITIDOS failed: ${e?.message}`);
      return res.status(500).json({ message: 'Error generando Excel de emitidos', error: e?.message });
    }
  }

  // Endpoint eliminado: pedidos emitidos (JSON)

  // Endpoint eliminado: pedidos emitidos export

  // Detalle de pedidos con stock disponible/pendiente
  @Get('detalle')
  async getPedidosDetalle(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
  ) {
    const empresa = usuEmpresa || req?.user?.usuEmpresa || 'UNE003';
    if (!empresa) throw new BadRequestException('usuEmpresa es requerido');
    return this.pedidosService.getPedidosDetalle(empresa, fechaInicio, fechaFin);
  }

  // Últimas órdenes de fabricación (widget en dashboard)
  @Get('of-recientes')
  async getOrdenesFabricacionRecientes(
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
  ) {
    const empresa = usuEmpresa || req?.user?.usuEmpresa || 'UNE003';
    return this.pedidosService.getOrdenesFabricacionRecientes(empresa);
  }

  // Reporte de margen por pedido
  @Get('margen')
  async getPedidosMargen(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException('fechaInicio y fechaFin son requeridos');
    }
    const empresa = usuEmpresa || req?.user?.usuEmpresa || 'UNE003';
    return this.pedidosService.getPedidosMargen(empresa, fechaInicio, fechaFin);
  }

  // Export Excel de MARGEN con SUB TOTALES por FAMILIA (solo export)
  @Get('margen/export')
  async exportPedidosMargenExcel(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException('fechaInicio y fechaFin son requeridos');
    }
    try {
      const empresa = usuEmpresa || req?.user?.empresa || req?.user?.usuEmpresa || '003';
      const buffer = await this.pedidosService.exportPedidosMargenExcel(empresa, fechaInicio, fechaFin);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="pedidos_margen.xlsx"');
      return res.send(buffer);
    } catch (e: any) {
      this.logger.error(`Export MARGEN failed: ${e?.message}`);
      return res.status(500).json({ message: 'Error generando Excel de margen', error: e?.message });
    }
  }

  // Export Excel de PARCIALES (backend genera archivo completo)
  @Get('parciales/export')
  async exportPedidosParcialesExcel(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    this.logger.debug(`Export PARCIALES requested fi=${fechaInicio} ff=${fechaFin}`);
    try {
      // Normalizar fechas si vienen en formato dd/MM/yyyy desde el front
      const toIso = (s?: string) => {
        if (s == null) return s as any;
        const trimmed = s.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return undefined as any;
        // dd/MM/yyyy -> yyyy-MM-dd con corrección de días inválidos (31/06 -> 30/06), maneja bisiesto
        const m = trimmed.match(/^([0-3]\d)\/([0-1]\d)\/(\d{4})$/);
        if (m) {
          let dd = parseInt(m[1], 10);
          const mm = parseInt(m[2], 10); // 1..12
          const yyyy = parseInt(m[3], 10);
          // último día del mes
          const lastDay = new Date(yyyy, mm, 0).getDate(); // JS usa mes base 1 si paso mm como 1..12 con day 0 del siguiente
          if (dd > lastDay) dd = lastDay;
          const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
          return `${yyyy}-${pad(mm)}-${pad(dd)}`;
        }
        // Si viene en ISO válido, devolver tal cual
        const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
          // Opcionalmente podríamos corregir día inválido también aquí; lo omitimos asumiendo que viene válido
          return trimmed;
        }
        return trimmed; // otro formato, dejarlo como llegó
      };
      let fi = toIso(fechaInicio);
      let ff = toIso(fechaFin);
      // Si llega solo una fecha, usarla para ambos extremos
      if (fi && !ff) ff = fi;
      if (!fi && ff) fi = ff;
      // Si ambas existen y están invertidas, intercambiar
      const isValid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (isValid(fi) && isValid(ff) && fi! > ff!) {
        const tmp = fi!; fi = ff; ff = tmp;
      }
      this.logger.debug(`Export PARCIALES normalized fi=${fi} ff=${ff}`);
      const empresa = usuEmpresa || req?.user?.empresa || req?.user?.usuEmpresa || '004';
      const buffer = await this.pedidosService.exportPedidosParcialesExcel(empresa, fi, ff);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="pedidos_parciales.xlsx"');
      return res.send(buffer);
    } catch (e: any) {
      this.logger.error(`Export PARCIALES failed: ${e?.message}`);
      return res.status(500).json({ message: 'Error generando Excel de parciales', error: e?.message });
    }
  }

  // Export Excel de AUTORIZADOS con columnas exactas solicitadas
  @Get('autorizados/export')
  async exportPedidosAutorizadosExcel(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('usuEmpresa') usuEmpresa?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    this.logger.debug(`Export AUTORIZADOS requested fi=${fechaInicio} ff=${fechaFin}`);
    try {
      const empresa = usuEmpresa || req?.user?.empresa || req?.user?.usuEmpresa || '004';
      const buffer = await this.pedidosService.exportPedidosAutorizadosExcel(empresa, fechaInicio, fechaFin);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="pedidos_autorizados.xlsx"');
      return res.send(buffer);
    } catch (e: any) {
      this.logger.error(`Export AUTORIZADOS failed: ${e?.message}`);
      return res.status(500).json({ message: 'Error generando Excel de autorizados', error: e?.message });
    }
  }
}