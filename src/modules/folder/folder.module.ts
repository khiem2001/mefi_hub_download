import { Module } from "@nestjs/common";
import { ClientsModule, ClientsModuleOptions } from "@nestjs/microservices";
import { TRANSPORT_SERVICE } from "configs/transport.config";
import { FolderController } from "./folder.controller";
import { FolderService } from "./folder.service";
import { CreateSymlinkStorageCommand } from "./command";
import { BullModule } from "@nestjs/bull";
import { WatchFolderProcessor } from "./queue/folder.processor";
import { ValidatorService } from "utils/validator.service";

@Module({
    imports: [
        ClientsModule.register([
            TRANSPORT_SERVICE['API_SERVICE'].redis,
            TRANSPORT_SERVICE['TRANSCODE_SERVICE'].redis,
        ] as ClientsModuleOptions),
        BullModule.registerQueue({ name: 'folder' }),
    ],
    controllers: [FolderController],
    providers: [
        FolderService,
        WatchFolderProcessor,
        ValidatorService,
        CreateSymlinkStorageCommand,
    ],
})
export class FolderModule { }
