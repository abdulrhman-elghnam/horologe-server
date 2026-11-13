import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropConsentAcceptedAt1794600327193 implements MigrationInterface {
  name = 'DropConsentAcceptedAt1794600327193';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "consent_accepted_at"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "consent_accepted_at" TIMESTAMP WITH TIME ZONE`);
  }
}
