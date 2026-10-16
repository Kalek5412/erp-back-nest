import { IsNotEmpty, IsDateString } from 'class-validator';

export class ConsultaDetallesDto {
  @IsNotEmpty()
  @IsDateString()
  from: string;

  @IsNotEmpty()
  @IsDateString()
  to: string;
} 