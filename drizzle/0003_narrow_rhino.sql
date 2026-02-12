ALTER TABLE `presentations` ADD `sourceFileUrl` text;--> statement-breakpoint
ALTER TABLE `presentations` ADD `sourceFileName` varchar(512);--> statement-breakpoint
ALTER TABLE `presentations` ADD `sourceFileType` varchar(16);--> statement-breakpoint
ALTER TABLE `presentations` ADD `sourceContent` text;