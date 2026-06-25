import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CdnStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
  readonly webAppBucket: s3.Bucket;
  readonly contentBucket: s3.Bucket;
}

export class CdnStack extends cdk.NestedStack {
  public readonly distribution: cloudfront.Distribution;
  public readonly contentDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    const { stageName, webAppBucket, contentBucket } = props;

    // Origin Access Identity for web app bucket
    const webAppOai = new cloudfront.OriginAccessIdentity(this, 'WebAppOAI', {
      comment: `OAI for learnverse-${stageName} web app`,
    });
    webAppBucket.grantRead(webAppOai);

    // CloudFront distribution for React web app (S3 origin)
    this.distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      comment: `learnverse-${stageName} web application`,
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(webAppBucket, {
          originAccessIdentity: webAppOai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        // SPA routing: return index.html for 404s (client-side routing)
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // Origin Access Identity for content bucket (audio, generated assets)
    const contentOai = new cloudfront.OriginAccessIdentity(this, 'ContentOAI', {
      comment: `OAI for learnverse-${stageName} content assets`,
    });
    contentBucket.grantRead(contentOai);

    // CloudFront distribution for content assets (TTS audio, generated files)
    this.contentDistribution = new cloudfront.Distribution(this, 'ContentDistribution', {
      comment: `learnverse-${stageName} content assets (audio, generated)`,
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(contentBucket, {
          originAccessIdentity: contentOai,
          originPath: '/generated',
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        '/audio/*': {
          origin: new cloudfront_origins.S3Origin(contentBucket, {
            originAccessIdentity: contentOai,
            originPath: '/audio',
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebAppDistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront domain for the web application',
    });

    new cdk.CfnOutput(this, 'ContentDistributionDomain', {
      value: this.contentDistribution.distributionDomainName,
      description: 'CloudFront domain for content assets (audio, generated)',
    });
  }
}
