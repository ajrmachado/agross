CREATE TABLE `whatsapp_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(20) NOT NULL,
	`messageType` varchar(64) NOT NULL DEFAULT 'morning_call',
	`status` enum('sent','failed','skipped') NOT NULL,
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `profileCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `whatsappOptIn` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD CONSTRAINT `whatsapp_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_whatsapp_logs_userId` ON `whatsapp_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_logs_sentAt` ON `whatsapp_logs` (`sentAt`);