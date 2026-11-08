import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/auth.types';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth('bearer')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Búsqueda global agrupada (programas, requisitos, casos de prueba, NC y documentos), hasta 5 ítems por grupo y solo los grupos con resultados. Mínimo 2 caracteres (422 `errors.q = minChars`). Los documentos restringidos no aparecen para roles sin permiso. Cualquier rol autenticado.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Texto a buscar (mínimo 2 caracteres)' })
  find(@CurrentUser() user: AuthUser, @Query('q') q: string | undefined) {
    return this.search.search(user, typeof q === 'string' ? q : undefined);
  }
}
