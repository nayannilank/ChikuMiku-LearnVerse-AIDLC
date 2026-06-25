import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
}

export class StorageStack extends cdk.NestedStack {
  public readonly contentBucket: s3.Bucket;
  public readonly webAppBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { stageName } = props;
    const isProd = stageName === 'prod';

    // Content Bucket — textbook page images, audio recordings, generated assets
    this.contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: `learnverse-${stageName}-content-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        // Audio recordings: transition to IA after 90 days
        {
          id: 'audio-lifecycle',
          prefix: 'audio/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        // Page images: transition to IA after 30 days, Glacier after 90 days
        {
          id: 'images-lifecycle',
          prefix: 'images/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        // Generated assets (TTS audio, etc.): transition to IA after 90 days
        {
          id: 'generated-assets-lifecycle',
          prefix: 'generated/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // Web App Bucket — React web app static files (served via CloudFront)
    this.webAppBucket = new s3.Bucket(this, 'WebAppBucket', {
      bucketName: `learnverse-${stageName}-webapp-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });
  }
}
