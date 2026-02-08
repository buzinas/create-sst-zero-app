const { POSTGRES_PASSWORD } = process.env

export default $config({
  app() {
    return {
      name: 'zero-app',
      removal: 'remove',
      protect: false,
      home: 'aws',
      providers: {
        aws: {
          region: 'us-east-1',
        },
        cloudflare: {},
      },
    }
  },
  async run() {
    const vpc = new sst.aws.Vpc('Vpc', {
      nat: { type: 'ec2', ec2: { instance: 't4g.micro' } },
      bastion: true,
    })

    const db = new sst.aws.Postgres('Database', {
      vpc,
      dev: {
        username: 'postgres',
        password: new sst.Secret('PostgresPassword', POSTGRES_PASSWORD).value,
        database: 'zero_app',
        port: 5432,
      },
      transform: {
        parameterGroup: {
          parameters: [
            {
              name: 'rds.logical_replication',
              value: '1',
              applyMethod: 'pending-reboot',
            },
          ],
        },
        instance: {
          backupRetentionPeriod: 1,
        },
      },
    })

    // Wildcard cert for ALBs (same region)
    const albWildcardCert = new aws.acm.Certificate('AlbWildcardCert', {
      domainName: '*.TODO:DOMAIN',
      validationMethod: 'DNS',
    })

    // us-east-1 provider + wildcard cert (required for CloudFront)
    const usEast1 = new aws.Provider('UsEast1', {
      region: 'us-east-1',
    })

    const cfWildcardCert = new aws.acm.Certificate(
      'CfWildcardCert',
      {
        domainName: '*.TODO:DOMAIN',
        validationMethod: 'DNS',
      },
      { provider: usEast1 },
    )

    const domainValidationOption = albWildcardCert.domainValidationOptions[0]

    // DNS validation — one record validates both certs (same domain)
    new cloudflare.DnsRecord('WildcardCertValidation', {
      zoneId: 'TODO:CLOUDFLARE_ZONE_ID',
      name: domainValidationOption.resourceRecordName,
      type: domainValidationOption.resourceRecordType,
      content: domainValidationOption.resourceRecordValue,
      proxied: false,
      ttl: 60,
    })

    new aws.acm.CertificateValidation('AlbCertValidated', {
      certificateArn: albWildcardCert.arn,
      validationRecordFqdns: [domainValidationOption.resourceRecordName],
    })

    new aws.acm.CertificateValidation(
      'CfCertValidated',
      {
        certificateArn: cfWildcardCert.arn,
        validationRecordFqdns: [domainValidationOption.resourceRecordName],
      },
      { provider: usEast1 },
    )

    const dbManagerFn = new sst.aws.Function('DbManager', {
      handler: 'infra/db-manager.handler',
      vpc,
      link: [db],
      timeout: '30 seconds',
    })

    return {
      vpc: vpc.id,
      db: db.id,
      albARN: albWildcardCert.arn,
      cfARN: cfWildcardCert.arn,
      dbManagerFunctionName: dbManagerFn.name,
    }
  },
})
