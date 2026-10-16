import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  usuCodigo: string;

  @IsString()
  @IsNotEmpty()
  usuPassword: string;

  @IsString()
  @IsOptional()
  usuEmpresa?: string;
  
  @IsString()
  @IsOptional()
  usuNombre?: string;
  
  @IsString()
  @IsOptional()
  usuNivel?: string;
}
