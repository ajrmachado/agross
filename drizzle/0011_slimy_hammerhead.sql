CREATE TABLE `organization_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`ownerId` int NOT NULL,
	`maxUsers` int NOT NULL DEFAULT 10,
	`plan` enum('morning_call','corporativo') NOT NULL DEFAULT 'corporativo',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`eventType` varchar(64) NOT NULL,
	`page` varchar(128),
	`feature` varchar(128),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_orgId_organizations_id_fk` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_events` ADD CONSTRAINT `usage_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_org_members_orgId` ON `organization_members` (`orgId`);--> statement-breakpoint
CREATE INDEX `idx_org_members_userId` ON `organization_members` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_organizations_ownerId` ON `organizations` (`ownerId`);--> statement-breakpoint
CREATE INDEX `idx_usage_events_userId` ON `usage_events` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_usage_events_createdAt` ON `usage_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_usage_events_eventType` ON `usage_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_usage_events_page` ON `usage_events` (`page`);