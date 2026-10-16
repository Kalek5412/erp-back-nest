import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('PEDCAB')
export class Pedcab {
  @PrimaryColumn({ type: 'varchar', length: 255, name: 'CFNUMPED' }) // Assuming CFNUMPED is the primary key
  cfnumped: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'CFCOTIZA' })
  cfcotiza: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'CFVENDE' }) // Seller code
  cfvende: string;

  @Column({ type: 'datetime', nullable: true, name: 'CFFECDOC' })
  cffecdoc: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'CFNOMBRE' }) // Client name
  cfnombre: string;

  // If PEDCAB has relationships with other entities like VENDEDOR or PEDDET,
  // those would be defined here with @ManyToOne, @OneToMany, etc.
  // For now, only the direct columns of PEDCAB are included.
} 