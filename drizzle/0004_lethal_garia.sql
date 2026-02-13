CREATE TABLE `chat_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`filename` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`fileSize` int NOT NULL,
	`s3Url` text NOT NULL,
	`extractedText` text,
	`status` enum('uploading','ready','error') NOT NULL DEFAULT 'uploading',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_files_fileId_unique` UNIQUE(`fileId`)
);
