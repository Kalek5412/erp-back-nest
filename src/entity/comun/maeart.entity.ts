import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'MAEART', database: '004BDCOMUN' })
export class MAEART {
  @PrimaryColumn({ type: 'varchar', length: 20, name: 'ACODIGO' })
  ACODIGO: string;

  @Column({ type: 'varchar', length: 2, name: 'ACODMON', nullable: true })
  ACODMON: string;

  @Column({ type: 'varchar', length: 2, name: 'ACODMONC', nullable: true })
  ACODMONC: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'ADESCTO', nullable: true })
  ADESCTO: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'AIGVPOR', nullable: true })
  AIGVPOR: number;

  @Column({ type: 'char', length: 1, name: 'AFPRELIB', nullable: true })
  AFPRELIB: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'APCOM', nullable: true })
  APCOM: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, name: 'APRECOM', nullable: true })
  APRECOM: number;

  @Column({ type: 'numeric', precision: 1, scale: 0, name: 'AFLAGIGV', nullable: true })
  AFLAGIGV: number;

  @Column({ type: 'numeric', precision: 1, scale: 0, name: 'FLG_EXONERADO_IGV', nullable: true })
  FLG_EXONERADO_IGV: number;
}