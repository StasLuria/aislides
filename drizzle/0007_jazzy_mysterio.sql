CREATE TABLE `slide_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presentationId` varchar(64) NOT NULL,
	`slideIndex` int NOT NULL,
	`versionNumber` int NOT NULL,
	`slideHtml` text NOT NULL,
	`slideData` json,
	`changeType` varchar(32) NOT NULL DEFAULT 'edit',
	`changeDescription` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slide_versions_id` PRIMARY KEY(`id`)
);
