import { IsString, IsNotEmpty } from 'class-validator';

export class GetRentabilidadDto {
  @IsString()
  @IsNotEmpty()
  fechaInicio: string;

  @IsString()
  @IsNotEmpty()
  fechaFin: string;
}
