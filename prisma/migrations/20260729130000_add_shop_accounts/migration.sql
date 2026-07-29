-- Shop login accounts for the client dashboard (additive)

ALTER TABLE `ReferralShop` ADD COLUMN `email` VARCHAR(191) NULL;
ALTER TABLE `ReferralShop` ADD COLUMN `username` VARCHAR(191) NULL;
ALTER TABLE `ReferralShop` ADD COLUMN `passwordHash` VARCHAR(191) NULL;
ALTER TABLE `ReferralShop` ADD UNIQUE INDEX `ReferralShop_username_key` (`username`);

-- Give the sample shop login credentials for quick testing (username: demo-shop / password: demo1234)
UPDATE `ReferralShop`
SET `username` = 'demo-shop', `passwordHash` = 'demo1234', `email` = 'demo@shop.test'
WHERE `code` = 'demo-shop';
