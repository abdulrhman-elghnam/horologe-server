import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommerceSchema1794665831275 implements MigrationInterface {
  name = 'CommerceSchema1794665831275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "recipient_name" character varying(120) NOT NULL, "phone" character varying(32) NOT NULL, "country" character varying(80) NOT NULL, "city" character varying(120) NOT NULL, "street" character varying(200) NOT NULL, "building" character varying(80), "apartment" character varying(80), "postal_code" character varying(20), "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_16aac8a9f6f9c1dd6bcb75ec02" ON "addresses" ("user_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_addresses_user_default" ON "addresses" ("user_id") WHERE "is_default" = true`);
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "admin_id" uuid NOT NULL, "action" character varying(80) NOT NULL, "resource" character varying(60) NOT NULL, "resource_id" character varying(100), "description" character varying(500), "ip_address" character varying(64), "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs" ("created_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_aeec69af874f018dc3c58fc0d2" ON "audit_logs" ("resource", "resource_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_88edc3fe51c9b0bad5388037e2" ON "audit_logs" ("admin_id", "created_at") `);
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "description" text, "logo" character varying(500), "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b15428f362be2200922952dc26" ON "brands" ("slug") `);
    await queryRunner.query(
      `CREATE TABLE "watch_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "watch_id" uuid NOT NULL, "sku" character varying(64) NOT NULL, "color" character varying(40), "price" numeric(12,2) NOT NULL, "compare_at_price" numeric(12,2), "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_143e13f7bf4c9c8889c4a1ada61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_60de48d252987e8de71f0ce02e" ON "watch_variants" ("watch_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6e7e81f5187b8c27219207e7fc" ON "watch_variants" ("sku") `);
    await queryRunner.query(
      `CREATE TABLE "carts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, CONSTRAINT "PK_b5f695a59f5ebb50af3c8160816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2ec1c94a977b940d85a4f498ae" ON "carts" ("user_id") `);
    await queryRunner.query(
      `CREATE TABLE "cart_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cart_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "quantity" integer NOT NULL, "price_at_add" numeric(12,2) NOT NULL, CONSTRAINT "CHK_cart_item_quantity_positive" CHECK ("quantity" > 0), CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d1a62275445322e93824d33dbf" ON "cart_items" ("cart_id", "variant_id") `);
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "parent_id" uuid, "description" text, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories" ("slug") `);
    await queryRunner.query(`CREATE INDEX "IDX_88cea2dc9c31951d06437879b4" ON "categories" ("parent_id") `);
    await queryRunner.query(
      `CREATE TABLE "watch_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "watch_id" uuid NOT NULL, "storage_key" character varying(300) NOT NULL, "mime_type" character varying(40) NOT NULL, "alt" character varying(200), "position" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_59b37e1585cec6d461fe07114d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_41c6255928cf11fb76780f0d81" ON "watch_images" ("watch_id") `);
    await queryRunner.query(`CREATE TYPE "public"."watch_gender" AS ENUM('men', 'women', 'unisex')`);
    await queryRunner.query(`CREATE TYPE "public"."watch_movement" AS ENUM('automatic', 'manual', 'quartz', 'solar', 'kinetic', 'smart')`);
    await queryRunner.query(`CREATE TYPE "public"."watch_display" AS ENUM('analog', 'digital', 'hybrid')`);
    await queryRunner.query(`CREATE TYPE "public"."watch_status" AS ENUM('draft', 'published', 'archived')`);
    await queryRunner.query(
      `CREATE TABLE "watches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "brand_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "model" character varying(120), "reference_number" character varying(80), "gender" "public"."watch_gender" NOT NULL DEFAULT 'unisex', "movement" "public"."watch_movement" NOT NULL, "display_type" "public"."watch_display" NOT NULL DEFAULT 'analog', "description" text, "warranty_months" integer NOT NULL DEFAULT '24', "status" "public"."watch_status" NOT NULL DEFAULT 'draft', "is_featured" boolean NOT NULL DEFAULT false, "min_price" numeric(12,2), "sold_count" integer NOT NULL DEFAULT '0', "rating_average" numeric(3,2) NOT NULL DEFAULT '0', "rating_count" integer NOT NULL DEFAULT '0', "published_at" TIMESTAMP WITH TIME ZONE, "specCase_material" character varying(80), "specCase_diameter" numeric(5,1), "specStrap_material" character varying(80), "specDial_color" character varying(40), "specGlass_type" character varying(60), "specWater_resistance" integer, "specPower_reserve" integer, CONSTRAINT "PK_c5e1fa5d29486c3bdada54343b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_fbbd0cfcdd05859242c05c6ab3" ON "watches" ("brand_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6ac12a798f20d7841351d2589" ON "watches" ("slug") `);
    await queryRunner.query(`CREATE INDEX "IDX_ce2c1f6f08b550a559008747cf" ON "watches" ("gender") `);
    await queryRunner.query(`CREATE INDEX "IDX_025718d680f3f1a913a22fd7fc" ON "watches" ("movement") `);
    await queryRunner.query(`CREATE INDEX "IDX_433113f420c7ae10f96a801906" ON "watches" ("status") `);
    await queryRunner.query(`CREATE INDEX "IDX_f08749ab614664ea7c99e3b046" ON "watches" ("is_featured") `);
    await queryRunner.query(`CREATE INDEX "IDX_942fecf7562e4451d4caac0e5c" ON "watches" ("min_price") `);
    await queryRunner.query(
      `CREATE TABLE "collections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "description" text, "start_date" TIMESTAMP WITH TIME ZONE, "end_date" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_21c00b1ebbd41ba1354242c5c4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_99d0d14f9f23b45d2c6648c4b5" ON "collections" ("slug") `);
    await queryRunner.query(`CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount')`);
    await queryRunner.query(
      `CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(40) NOT NULL, "description" character varying(300), "discount_type" "public"."discount_type" NOT NULL, "discount_value" numeric(12,2) NOT NULL, "min_order_amount" numeric(12,2) NOT NULL DEFAULT '0', "max_discount" numeric(12,2), "usage_limit" integer, "used_count" integer NOT NULL DEFAULT '0', "per_user_limit" integer, "start_date" TIMESTAMP WITH TIME ZONE, "end_date" TIMESTAMP WITH TIME ZONE, "first_order_only" boolean NOT NULL DEFAULT false, "eligible_watch_ids" uuid array NOT NULL DEFAULT '{}', "eligible_category_ids" uuid array NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_coupon_used_count_non_negative" CHECK ("used_count" >= 0), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e025109230e82925843f2a14c4" ON "coupons" ("code") `);
    await queryRunner.query(`CREATE TYPE "public"."coupon_usage_status" AS ENUM('reserved', 'confirmed', 'released')`);
    await queryRunner.query(
      `CREATE TABLE "coupon_usages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "coupon_id" uuid NOT NULL, "user_id" uuid NOT NULL, "order_id" uuid NOT NULL, "discount_amount" numeric(12,2) NOT NULL, "status" "public"."coupon_usage_status" NOT NULL DEFAULT 'reserved', "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_01ff9a1cac559c4ae2e4179d0a3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f017af60a02209a6b045f673ca" ON "coupon_usages" ("order_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_1fa2cbd0178e94678cd55e376b" ON "coupon_usages" ("coupon_id", "user_id") `);
    await queryRunner.query(
      `CREATE TABLE "inventories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "variant_id" uuid NOT NULL, "available_quantity" integer NOT NULL DEFAULT '0', "reserved_quantity" integer NOT NULL DEFAULT '0', "low_stock_threshold" integer NOT NULL DEFAULT '5', CONSTRAINT "REL_1a0af77c4fc771252ed020c49e" UNIQUE ("variant_id"), CONSTRAINT "CHK_inventory_reserved_non_negative" CHECK ("reserved_quantity" >= 0), CONSTRAINT "CHK_inventory_available_non_negative" CHECK ("available_quantity" >= 0), CONSTRAINT "PK_7b1946392ffdcb50cfc6ac78c0e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1a0af77c4fc771252ed020c49e" ON "inventories" ("variant_id") `);
    await queryRunner.query(`CREATE TYPE "public"."inventory_movement_type" AS ENUM('restock', 'adjustment', 'reserve', 'release', 'sale', 'return')`);
    await queryRunner.query(
      `CREATE TABLE "inventory_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "variant_id" uuid NOT NULL, "admin_id" uuid, "type" "public"."inventory_movement_type" NOT NULL, "quantity" integer NOT NULL, "reason" character varying(300), "reference_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d7597827c1dcffae889db3ab873" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_3d81ea331908e37746a408a5c2" ON "inventory_movements" ("reference_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_38e2f32be31de92b8cec259304" ON "inventory_movements" ("variant_id", "created_at") `);
    await queryRunner.query(`CREATE TYPE "public"."notification_type" AS ENUM('order', 'payment', 'shipment', 'review', 'price', 'inventory', 'system')`);
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(150) NOT NULL, "message" character varying(1000) NOT NULL, "type" "public"."notification_type" NOT NULL, "reference_id" uuid, "data" jsonb, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_notifications_unread" ON "notifications" ("user_id") WHERE "is_read" = false`);
    await queryRunner.query(`CREATE INDEX "IDX_310667f935698fcd8cb319113a" ON "notifications" ("user_id", "created_at") `);
    await queryRunner.query(
      `CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded')`);
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "order_number" character varying(32) NOT NULL, "subtotal" numeric(12,2) NOT NULL, "discount" numeric(12,2) NOT NULL DEFAULT '0', "shipping_cost" numeric(12,2) NOT NULL DEFAULT '0', "total" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "status" "public"."order_status" NOT NULL DEFAULT 'pending', "payment_status" "public"."payment_status" NOT NULL DEFAULT 'pending', "payment_method" character varying(40), "coupon_id" uuid, "coupon_code" character varying(40), "shipping_method_id" uuid NOT NULL, "shipping_method_name" character varying(120) NOT NULL, "shipping_address" jsonb NOT NULL, "notes" character varying(500), "idempotency_key" character varying(100), "expires_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" character varying(300), "return_reason" character varying(500), "status_history" jsonb NOT NULL DEFAULT '[]', "paid_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_75eba1c6b1a66b09f2a97e6927" ON "orders" ("order_number") `);
    await queryRunner.query(`CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders" ("status") `);
    await queryRunner.query(`CREATE INDEX "IDX_892cef7cd3962597f0a1c00679" ON "orders" ("payment_status") `);
    await queryRunner.query(`CREATE INDEX "IDX_d5630ca8f6ad3c8ccd748aa2e6" ON "orders" ("expires_at") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_orders_user_idempotency_key" ON "orders" ("user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_fbfc1475fc6797244d160068cb" ON "orders" ("user_id", "created_at") `);
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "watch_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "watch_name" character varying(200) NOT NULL, "sku" character varying(64) NOT NULL, "color" character varying(40), "image_id" uuid, "unit_price" numeric(12,2) NOT NULL, "quantity" integer NOT NULL, "total_price" numeric(12,2) NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_145532db85752b29c57d2b7b1f" ON "order_items" ("order_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_845f9d8619bb06c5b34c9e71bf" ON "order_items" ("watch_id") `);
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "provider" character varying(40) NOT NULL, "transaction_id" character varying(200), "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL, "status" "public"."payment_status" NOT NULL DEFAULT 'pending', "checkout_url" character varying(1000), "failure_reason" character varying(300), "paid_at" TIMESTAMP WITH TIME ZONE, "refunded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_provider_transaction" ON "payments" ("provider", "transaction_id") WHERE "transaction_id" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected')`);
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "watch_id" uuid NOT NULL, "order_id" uuid, "is_verified_purchase" boolean NOT NULL DEFAULT false, "rating" smallint NOT NULL, "title" character varying(120), "comment" text, "status" "public"."review_status" NOT NULL DEFAULT 'pending', "rejection_reason" character varying(300), CONSTRAINT "CHK_review_rating_range" CHECK ("rating" BETWEEN 1 AND 5), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_4cbe80e30fd5615ab84ed83148" ON "reviews" ("watch_id", "status", "created_at") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ac741fe10acb51dbe30317f0fc" ON "reviews" ("user_id", "watch_id") `);
    await queryRunner.query(
      `CREATE TABLE "wishlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "watch_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0bd52924a97cda208ed2a07bd69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e2ab7b193dfd7161c0abfaae37" ON "wishlist_items" ("user_id", "watch_id") `);
    await queryRunner.query(
      `CREATE TABLE "compare_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "watch_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_38e4860398e54a485dcffba3e36" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f3ca20004e0c539e41e9f2e37f" ON "compare_items" ("user_id", "watch_id") `);
    await queryRunner.query(
      `CREATE TABLE "shipping_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(40) NOT NULL, "name" character varying(120) NOT NULL, "base_price" numeric(12,2) NOT NULL, "free_shipping_threshold" numeric(12,2), "international_surcharge" numeric(12,2) NOT NULL DEFAULT '0', "estimated_days" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_5bee9dd62a8b72d6d9caabd63cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e290dcae2c0ff391ceea3e8978" ON "shipping_methods" ("code") `);
    await queryRunner.query(
      `CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "shipping_method_id" uuid NOT NULL, "tracking_number" character varying(80) NOT NULL, "carrier" character varying(60) NOT NULL, "status" "public"."shipment_status" NOT NULL DEFAULT 'pending', "events" jsonb NOT NULL DEFAULT '[]', "shipped_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e86fac2a18a75dcb82bfbb23f4" ON "shipments" ("order_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e148d569550cfa0295ccf23706" ON "shipments" ("tracking_number") `);
    await queryRunner.query(`CREATE INDEX "IDX_6a19baf6dd62cac42fbb40a518" ON "shipments" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source" character varying(60) NOT NULL, "event_id" character varying(200) NOT NULL, "type" character varying(60) NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4cba37e6a0acb5e1fc49c34ebfd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_74824434c7191e1191b27a35d0" ON "webhook_events" ("source", "event_id") `);
    await queryRunner.query(
      `CREATE TABLE "watch_categories" ("watch_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "PK_700926105a8795d4e33c0c8cb2c" PRIMARY KEY ("watch_id", "category_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_ce649ad3267e02ab05c01daf83" ON "watch_categories" ("watch_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_a610cb9a77dc54fe9c5235863f" ON "watch_categories" ("category_id") `);
    await queryRunner.query(
      `CREATE TABLE "collection_watches" ("collection_id" uuid NOT NULL, "watch_id" uuid NOT NULL, CONSTRAINT "PK_c4dfc38f2379f4b22f8de6d775f" PRIMARY KEY ("collection_id", "watch_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_548512872fb5bc41c7fcb8f263" ON "collection_watches" ("collection_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_c877581b0e3719cc187a660769" ON "collection_watches" ("watch_id") `);
    await queryRunner.query(
      `ALTER TABLE "addresses" ADD CONSTRAINT "FK_16aac8a9f6f9c1dd6bcb75ec023" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "watch_variants" ADD CONSTRAINT "FK_60de48d252987e8de71f0ce02e6" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_6385a745d9e12a89b859bb25623" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_ede780fc2b865d1d1323e598038" FOREIGN KEY ("variant_id") REFERENCES "watch_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "watch_images" ADD CONSTRAINT "FK_41c6255928cf11fb76780f0d81b" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "watches" ADD CONSTRAINT "FK_fbbd0cfcdd05859242c05c6ab38" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventories" ADD CONSTRAINT "FK_1a0af77c4fc771252ed020c49e8" FOREIGN KEY ("variant_id") REFERENCES "watch_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_92c2f6884ebf6ab880d157e5044" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" ADD CONSTRAINT "FK_318f943b7fbdbf375e40371a119" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "compare_items" ADD CONSTRAINT "FK_b1abab0a38abb4088e50d7cc79d" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_e86fac2a18a75dcb82bfbb23f43" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_c0b004da33090be7e934ac28e2b" FOREIGN KEY ("shipping_method_id") REFERENCES "shipping_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "watch_categories" ADD CONSTRAINT "FK_ce649ad3267e02ab05c01daf839" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "watch_categories" ADD CONSTRAINT "FK_a610cb9a77dc54fe9c5235863f3" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_watches" ADD CONSTRAINT "FK_548512872fb5bc41c7fcb8f263e" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_watches" ADD CONSTRAINT "FK_c877581b0e3719cc187a6607691" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "collection_watches" DROP CONSTRAINT "FK_c877581b0e3719cc187a6607691"`);
    await queryRunner.query(`ALTER TABLE "collection_watches" DROP CONSTRAINT "FK_548512872fb5bc41c7fcb8f263e"`);
    await queryRunner.query(`ALTER TABLE "watch_categories" DROP CONSTRAINT "FK_a610cb9a77dc54fe9c5235863f3"`);
    await queryRunner.query(`ALTER TABLE "watch_categories" DROP CONSTRAINT "FK_ce649ad3267e02ab05c01daf839"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_c0b004da33090be7e934ac28e2b"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_e86fac2a18a75dcb82bfbb23f43"`);
    await queryRunner.query(`ALTER TABLE "compare_items" DROP CONSTRAINT "FK_b1abab0a38abb4088e50d7cc79d"`);
    await queryRunner.query(`ALTER TABLE "wishlist_items" DROP CONSTRAINT "FK_318f943b7fbdbf375e40371a119"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_92c2f6884ebf6ab880d157e5044"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_a922b820eeef29ac1c6800e826a"`);
    await queryRunner.query(`ALTER TABLE "inventories" DROP CONSTRAINT "FK_1a0af77c4fc771252ed020c49e8"`);
    await queryRunner.query(`ALTER TABLE "watches" DROP CONSTRAINT "FK_fbbd0cfcdd05859242c05c6ab38"`);
    await queryRunner.query(`ALTER TABLE "watch_images" DROP CONSTRAINT "FK_41c6255928cf11fb76780f0d81b"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`);
    await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_ede780fc2b865d1d1323e598038"`);
    await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_6385a745d9e12a89b859bb25623"`);
    await queryRunner.query(`ALTER TABLE "watch_variants" DROP CONSTRAINT "FK_60de48d252987e8de71f0ce02e6"`);
    await queryRunner.query(`ALTER TABLE "addresses" DROP CONSTRAINT "FK_16aac8a9f6f9c1dd6bcb75ec023"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c877581b0e3719cc187a660769"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_548512872fb5bc41c7fcb8f263"`);
    await queryRunner.query(`DROP TABLE "collection_watches"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a610cb9a77dc54fe9c5235863f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ce649ad3267e02ab05c01daf83"`);
    await queryRunner.query(`DROP TABLE "watch_categories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_74824434c7191e1191b27a35d0"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6a19baf6dd62cac42fbb40a518"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e148d569550cfa0295ccf23706"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e86fac2a18a75dcb82bfbb23f4"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TYPE "public"."shipment_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e290dcae2c0ff391ceea3e8978"`);
    await queryRunner.query(`DROP TABLE "shipping_methods"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f3ca20004e0c539e41e9f2e37f"`);
    await queryRunner.query(`DROP TABLE "compare_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e2ab7b193dfd7161c0abfaae37"`);
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ac741fe10acb51dbe30317f0fc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4cbe80e30fd5615ab84ed83148"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TYPE "public"."review_status"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_payments_provider_transaction"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b2f7b823a21562eeca20e72b00"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payment_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_845f9d8619bb06c5b34c9e71bf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_145532db85752b29c57d2b7b1f"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fbfc1475fc6797244d160068cb"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_orders_user_idempotency_key"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d5630ca8f6ad3c8ccd748aa2e6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_892cef7cd3962597f0a1c00679"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_775c9f06fc27ae3ff8fb26f2c4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_75eba1c6b1a66b09f2a97e6927"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."order_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_310667f935698fcd8cb319113a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_unread"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notification_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_38e2f32be31de92b8cec259304"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3d81ea331908e37746a408a5c2"`);
    await queryRunner.query(`DROP TABLE "inventory_movements"`);
    await queryRunner.query(`DROP TYPE "public"."inventory_movement_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1a0af77c4fc771252ed020c49e"`);
    await queryRunner.query(`DROP TABLE "inventories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1fa2cbd0178e94678cd55e376b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f017af60a02209a6b045f673ca"`);
    await queryRunner.query(`DROP TABLE "coupon_usages"`);
    await queryRunner.query(`DROP TYPE "public"."coupon_usage_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e025109230e82925843f2a14c4"`);
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(`DROP TYPE "public"."discount_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_99d0d14f9f23b45d2c6648c4b5"`);
    await queryRunner.query(`DROP TABLE "collections"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_942fecf7562e4451d4caac0e5c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f08749ab614664ea7c99e3b046"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_433113f420c7ae10f96a801906"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_025718d680f3f1a913a22fd7fc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ce2c1f6f08b550a559008747cf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f6ac12a798f20d7841351d2589"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fbbd0cfcdd05859242c05c6ab3"`);
    await queryRunner.query(`DROP TABLE "watches"`);
    await queryRunner.query(`DROP TYPE "public"."watch_status"`);
    await queryRunner.query(`DROP TYPE "public"."watch_display"`);
    await queryRunner.query(`DROP TYPE "public"."watch_movement"`);
    await queryRunner.query(`DROP TYPE "public"."watch_gender"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_41c6255928cf11fb76780f0d81"`);
    await queryRunner.query(`DROP TABLE "watch_images"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_88cea2dc9c31951d06437879b4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d1a62275445322e93824d33dbf"`);
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2ec1c94a977b940d85a4f498ae"`);
    await queryRunner.query(`DROP TABLE "carts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6e7e81f5187b8c27219207e7fc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_60de48d252987e8de71f0ce02e"`);
    await queryRunner.query(`DROP TABLE "watch_variants"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b15428f362be2200922952dc26"`);
    await queryRunner.query(`DROP TABLE "brands"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_88edc3fe51c9b0bad5388037e2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aeec69af874f018dc3c58fc0d2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_addresses_user_default"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_16aac8a9f6f9c1dd6bcb75ec02"`);
    await queryRunner.query(`DROP TABLE "addresses"`);
  }
}
