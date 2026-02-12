CREATE TABLE `chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`presentationId` varchar(64),
	`phase` enum('greeting','topic_received','mode_selection','generating_quick','structure_review','slide_content','slide_design','completed','error') NOT NULL DEFAULT 'greeting',
	`chatMode` enum('quick','stepbystep'),
	`messages` json,
	`workingState` json,
	`topic` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
