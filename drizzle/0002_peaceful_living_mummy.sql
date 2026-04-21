CREATE TABLE `commodity_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`name` varchar(64) NOT NULL,
	`price` decimal(12,4) NOT NULL,
	`prevClose` decimal(12,4),
	`change` decimal(10,4),
	`changePct` decimal(8,4),
	`currency` varchar(8) NOT NULL DEFAULT 'USX',
	`exchange` varchar(32),
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commodity_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_commodity_symbol_fetchedAt` ON `commodity_prices` (`symbol`,`fetchedAt`);