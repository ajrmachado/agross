CREATE TABLE `whatsapp_access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_access_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_access_tokens` ADD CONSTRAINT `whatsapp_access_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_wat_token` ON `whatsapp_access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_wat_userId` ON `whatsapp_access_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_wat_expiresAt` ON `whatsapp_access_tokens` (`expiresAt`);