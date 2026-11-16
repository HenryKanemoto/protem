import { MigrationInterface, QueryRunner } from "typeorm";

// Subcategoria opcional do item (ex.: Kits de eletrônica > Arduino). Só acrescenta uma coluna que aceita nulo,
// então nenhum item existente muda. Os itens da demonstração ganham a subcategoria que o seed do frontend usa.
export class ItemSubcategoria1791597500000 implements MigrationInterface {
    name = 'ItemSubcategoria1791597500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`itens\` ADD \`subcategoriaId\` varchar(64) NULL AFTER \`categoriaId\``);
        const demonstracao: Record<string, string[]> = {
            'sub-arduino': ['item-06', 'item-07'],
            'sub-raspberry': ['item-08'],
            'sub-robotica': ['item-09'],
            'sub-ferr-manuais': ['item-10'],
            'sub-ferr-eletricas': ['item-11'],
            'sub-ferr-medicao': ['item-12'],
            'sub-lab-microscopia': ['item-13'],
            'sub-lab-medicao': ['item-14', 'item-15'],
        };
        for (const [subcategoriaId, ids] of Object.entries(demonstracao)) {
            await queryRunner.query(`UPDATE \`itens\` SET \`subcategoriaId\` = ? WHERE \`id\` IN (${ids.map(() => '?').join(', ')})`, [subcategoriaId, ...ids]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`itens\` DROP COLUMN \`subcategoriaId\``);
    }
}
