import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('PLAN_PRODUCCION')
export class PlanProduccion {
    @PrimaryColumn({ name: 'FECHA_DESDE', type: 'smalldatetime' })
    fechaDesde: Date;

    @PrimaryColumn({ name: 'FECHA_HASTA', type: 'smalldatetime' })
    fechaHasta: Date;

    @PrimaryColumn({ name: 'ACODIGO', length: 20 })
    aCodigo: string;

    @Column({ name: 'CANT_PROD', type: 'numeric', precision: 18, scale: 6 })
    cantProd: number;
}
