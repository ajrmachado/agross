ALTER TABLE `users` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionPlan` enum('essencial','estrategico','corporativo');--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionEndsAt` timestamp;