CREATE TABLE `export_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presentationId` varchar(64) NOT NULL,
	`format` enum('pptx','pdf') NOT NULL,
	`themePreset` varchar(64),
	`isShared` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `export_events_id` PRIMARY KEY(`id`)
);
