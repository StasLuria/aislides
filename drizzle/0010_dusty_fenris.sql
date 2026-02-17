CREATE TABLE `generation_errors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presentationId` varchar(64),
	`sessionId` varchar(64),
	`severity` enum('fatal','warning','info') NOT NULL DEFAULT 'warning',
	`stage` varchar(128) NOT NULL,
	`errorType` varchar(128) NOT NULL,
	`message` text NOT NULL,
	`stackTrace` text,
	`context` json,
	`mode` varchar(32),
	`recovered` boolean NOT NULL DEFAULT false,
	`recoveryAction` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generation_errors_id` PRIMARY KEY(`id`)
);
