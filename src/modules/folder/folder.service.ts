import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { downloadFromUrl } from 'helpers/download';
import { extractFileNameFromPath, getFileNameWithoutExtension } from 'helpers/file';
import { timeout } from 'rxjs';
const { resolve } = require('path');
import { v4 as uuid } from 'uuid';
import axios from 'axios'
import * as fs from 'fs'
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { ValidatorService } from 'utils/validator.service';



@Injectable()
export class FolderService {

    constructor(
        private readonly config: ConfigService,
        @Inject('API_SERVICE') private readonly _APIService: ClientProxy,
        @Inject('TRANSCODE_SERVICE') private readonly _transcodeService: ClientProxy,
        @InjectQueue('folder') private readonly _queue: Queue,
        private readonly _validatorService: ValidatorService,
    ) { }




    async downloadFileFromFoler(input: any, userId: string) {
        const { templateId, fileOriginals, organizationId } = input;
        const folder = this.config.get<string>('FOLDER');

        for (const file of fileOriginals) {
            const { mimeType, fileSize, url } = file;
            const queueRequest = { templateId, mimeType, organizationId, fileSize }
            const fileName = `${uuid()}.mp4`;
            //download file
            await this._queue.add('download', {
                url,
                fileName,
                folder,
                queueRequest
            });
        }
        return { success: true }
    }

    async handlerTranscodePackage(path: string, input: any, fileName: string) {
        const { templateId, mimeType, organizationId, fileSize } = input
        // TODO: Create media
        const media = await this._APIService
            .send('CREATE_MEDIA', {
                path,
                mimeType,
                name: getFileNameWithoutExtension(fileName),
                fileName: extractFileNameFromPath(path),
                organizationId,
                fileSize,
                userId: "64ffe24c97c136fa654a05cd",
                description: fileName,
                status: 'UPLOADED'
            })
            .pipe(timeout(15000))
            .toPromise()
            .then((result) => {
                const { error, message, data: media } = result;
                if (error) {
                    Logger.debug(`Create media with error : ${message}`);
                }
                return media;
            })
            .catch((error) => {
                Logger.debug(`Create media with error : ${error.message}`);
                return;
            });

        //handler transcode with package
        if (this._validatorService.canTranscode(mimeType)) {
            // TODO: Update media to "TRANSCODING"
            await this._APIService
                .send('UPDATE_MEDIA_BY_ID', {
                    _id: media._id,
                    status: 'TRANSCODING',
                })
                .pipe(timeout(15000))
                .toPromise()
                .then((result) => {
                    const { error, message, data } = result;
                    if (error) {
                        Logger.debug(
                            `Update media status [TRANSCODING] with error : ${message}`,
                        );
                        return;
                    }
                    return data;
                })
                .catch((error) => {
                    Logger.debug(
                        `Update media status [TRANSCODING] with error : ${error.message}`,
                    );
                    return;
                });

            // TODO: get template transcode
            const template = await this._APIService
                .send('GET_TRANSCODE_TEMPLATE', {
                    id: templateId,
                })
                .pipe(timeout(15000))
                .toPromise()
                .then(async (result) => {
                    const { error, message, data } = result;
                    if (error) {
                        Logger.debug(`Get media template with error : ${message}`);
                        return;
                    }
                    return data;
                })
                .catch((error) => {
                    Logger.debug(`Get media template with error : ${error.message}`);
                    return;
                });

            // TODO: Create media profile
            const { codec: codecs, presets, packs } = template;
            const { _id: mediaId } = media;
            await Promise.all(
                codecs.map(async (codec: any) => {
                    for (const preset of presets) {
                        const { videoBitrate, frames, audioBitrate, frameSize } = preset;
                        await this._APIService
                            .send('CREATE_MEDIA_PROFILE', {
                                mediaId,
                                codec,
                                videoBitrate,
                                frames,
                                audioBitrate,
                                name: frameSize.height,
                                frameSize,
                            })
                            .pipe(timeout(15000))
                            .toPromise()
                            .then((result) => {
                                const { error, message } = result;
                                if (error) {
                                    Logger.debug(
                                        `Create media profile with error : ${message}`,
                                    );
                                    return;
                                }
                            })
                            .catch((error) => {
                                Logger.debug(
                                    `Create media profile with error : ${error.message}`,
                                );
                                return;
                            });
                    }
                }),
            );

            // TODO: Create media packaging
            const packsPromise = packs.map(async (pack: string) => {
                for (const codec of codecs) {
                    await this._APIService
                        .send('CREATE_MEDIA_PACKAGING', {
                            codec,
                            mediaId,
                            pack,
                        })
                        .pipe(timeout(15000))
                        .toPromise()
                        .then((result) => {
                            const { error, message } = result;
                            if (error) {
                                Logger.debug(
                                    `Create media packaging with error : ${message}`,
                                );
                                return;
                            }
                        })
                        .catch((error) => {
                            Logger.debug(
                                `Create media packaging with error : ${error.message}`,
                            );
                            return;
                        });
                }
            });

            await Promise.all(packsPromise);

            // TODO: Get media with profile and call to service transcode
            const mediaTranscode = await this._APIService
                .send('GET_MEDIA_BY_ID', {
                    id: media._id.toString(),
                })
                .pipe(timeout(15000))
                .toPromise()
                .then(async (result) => {
                    const { error, message, data } = result;
                    if (error) {
                        Logger.debug(`Get media with error : ${message}`);
                        return;
                    }
                    return data;
                })
                .catch((error) => {
                    Logger.debug(`Get media with error : ${error.message}`);
                    return;
                });

            // TODO: Call to service transcode
            await this._transcodeService
                .send('TRANSCODE_MEDIA_FILE', {
                    media: mediaTranscode,
                })
                .toPromise()
                .catch((error) => {
                    Logger.debug(
                        `Transcode media profile with error : ${error.message}`,
                    );
                });
        }
    }

    async downloadFromUrl(url, folder, fileName) {
        try {
            const fullPath = resolve(folder, fileName);

            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
            }

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
            });

            const writer = fs.createWriteStream(fullPath);
            response.data.pipe(writer);

            return await new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('Video downloaded successfully!');
                    resolve(fullPath);
                });
                writer.on('error', reject);
            });


        } catch (error) {
            throw new Error('Download failed: ' + error.message);
        }
    };
}