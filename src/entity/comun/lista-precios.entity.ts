import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'LISTA_PRECIOS', database: '004BDCOMUN' })
export class ListaPrecios {
  @PrimaryColumn({ type: 'varchar', length: 4, name: 'COD_LISPRE' })
  COD_LISPRE: string;

  @PrimaryColumn({ type: 'varchar', length: 20, name: 'COD_ARTI' })
  COD_ARTI: string;

  @Column({ type: 'numeric', precision: 15, scale: 6, name: 'PRE_ACT', nullable: true })
  PRE_ACT: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 6, name: 'PRE_ANT', nullable: true })
  PRE_ANT: number | null;

  // For smalldatetime, TypeORM typically uses Date. It might need a transformer for exact smalldatetime MSSQL type if issues arise.
  @Column({ type: 'datetime', name: 'DIA_HORA', nullable: true })
  DIA_HORA: Date | null;

  @Column({ type: 'varchar', length: 10, name: 'USUA_RES', nullable: true })
  USUA_RES: string | null;

  @Column({ type: 'bit', name: 'FLAG_IGVACT' })
  FLAG_IGVACT: boolean;

  @Column({ type: 'bit', name: 'FLAG_IGVANT' })
  FLAG_IGVANT: boolean;

  @Column({ type: 'varchar', length: 6, name: 'UNI_LISPRE', nullable: true })
  UNI_LISPRE: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 6, name: 'CANMAX', nullable: true })
  CANMAX: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 6, name: 'CANMIN', nullable: true })
  CANMIN: number | null;

  @Column({ type: 'varchar', length: 2, name: 'MON_PRE', nullable: true })
  MON_PRE: string | null;
} 