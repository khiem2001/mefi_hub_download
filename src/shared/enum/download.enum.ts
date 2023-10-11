import { registerEnumType } from '@nestjs/graphql';

export enum SocialSource {
  FACEBOOK = 'FACEBOOK',
  YOUTUBE = 'YOUTUBE',
  MP4 = 'MP4',
  OTHER = 'OTHER',
}

registerEnumType(SocialSource, { name: 'SocialSource' });
