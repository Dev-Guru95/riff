-- Billing-aware coupons: which plans a code discounts, and how long a
-- 100%-off code grants access for. Both additive with defaults, so existing
-- rows keep working (every plan, one month).
ALTER TABLE "Coupon" ADD COLUMN     "plans" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "durationMonths" INTEGER NOT NULL DEFAULT 1;
