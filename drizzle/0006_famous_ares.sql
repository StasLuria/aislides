ALTER TABLE `presentations` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `presentations` ADD `shareEnabled` boolean DEFAULT false NOT NULL;