ALTER TABLE `daily_summaries` ADD `linkedinPost` text;--> statement-breakpoint
ALTER TABLE `daily_summaries` ADD `imageUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `daily_summaries` ADD `imagePrompt` text;--> statement-breakpoint
ALTER TABLE `daily_summaries` ADD `approvalStatus` enum('draft','pending_approval','approved','rejected') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_summaries` ADD `approvedAt` timestamp;