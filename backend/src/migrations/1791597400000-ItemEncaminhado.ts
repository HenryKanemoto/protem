import { MigrationInterface, QueryRunner } from "typeorm";

// Acrescenta a situação "encaminhado" aos itens: item sem conserto que foi enviado a um destino
// (CRC da Unifap, SENAI Lab...) e saiu do acervo. Só acrescenta um valor ao enum; nenhum dado muda.
export class ItemEncaminhado1791597400000 implements MigrationInterface {
    name = 'ItemEncaminhado1791597400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`itens\` MODIFY \`status\` enum ('disponivel', 'solicitado', 'reservado', 'emprestado', 'atrasado', 'manutencao', 'encaminhado') NOT NULL DEFAULT 'disponivel'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Sem o valor novo, os itens encaminhados voltam para a manutenção antes de o enum encolher
        await queryRunner.query(`UPDATE \`itens\` SET \`status\` = 'manutencao' WHERE \`status\` = 'encaminhado'`);
        await queryRunner.query(`ALTER TABLE \`itens\` MODIFY \`status\` enum ('disponivel', 'solicitado', 'reservado', 'emprestado', 'atrasado', 'manutencao') NOT NULL DEFAULT 'disponivel'`);
    }
}
