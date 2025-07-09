import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class MyServerlessAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const table = new dynamodb.Table(this, 'NotesTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      tableName: 'notes',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

  // Create Lambda function
  const createNoteFunction = new lambda.Function(this, 'createNoteFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    code: lambda.Code.fromInline(`
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

      const client = new DynamoDBClient({});
      const docClient = DynamoDBDocumentClient.from(client);

      exports.handler = async (event) => {
        console.log('Received event:', JSON.stringify(event, null, 2));

        try {
          const body = JSON.parse(event.body);

          const note = {
            id: Date.now().toString(),
            title: body.title,
            content: body.content,
            createdAt: new Date().toISOString()
          };

          await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: note
          }));

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(note)
          };
        } catch (error) {
          console.error('Error:', error);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Something went wrong' })
          };
        }
      };
    `),
    handler: 'index.handler',
    environment: {
      TABLE_NAME: table.tableName,
    },
  });

  const getAllNotesFunction = new lambda.Function(this, 'GetAllNotesFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    code: lambda.Code.fromInline(`
                                    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
                                    const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
                                    
                                    const client = new DynamoDBClient({});
                                    const docClient = DynamoDBDocumentClient.from(client);

                                    exports.handler = async (event) => {
                                      console.log('Received event:', JSON.stringify(event, null, 2));

                                      try {
                                        // Scan the table to get all notes
                                        const result = await docClient.send(new ScanCommand({
                                          TableName: process.env.TABLE_NAME
                                        }));

                                        // Sort by creation date (newest first)
                                        const notes = result.Items ? result.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];

                                        return {
                                          statusCode: 200,
                                          headers: {
                                            'Access-Control-Allow-Origin': '*',
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({
                                            notes: notes,
                                            count: notes.length
                                          })
                                        };
                                      } catch (error) {
                                        console.error('Error:', error);
                                        return {
                                          statusCode: 500,
                                          headers: {
                                            'Access-Control-Allow-Origin': '*',
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ error: 'Something went wrong' })
                                        };
                                      }
                                    };
                                    `),
                                    handler: 'index.handler',
                                    environment: {
                                      TABLE_NAME: table.tableName,
                                    },
  });


  // Grant lambda permission to write to DynamoDB
  table.grantWriteData(createNoteFunction);
  table.grantReadData(getAllNotesFunction);

  // Create API Gateway
  const api = new apigateway.RestApi(this, 'NotesApi', {
    restApiName: 'Notes API',
    description: 'Simple notes API',
    defaultCorsPreflightOptions: {
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Content-Type'],
    },
  });

  // Connect API to lambda
  const notes = api.root.addResource('notes');
  notes.addMethod('POST', new apigateway.LambdaIntegration(createNoteFunction));
  notes.addMethod('GET', new apigateway.LambdaIntegration(getAllNotesFunction));

  // Output the API URL so you can test it
  new cdk.CfnOutput(this, 'ApiUrl', {
    value: api.url,
    description: 'API Gateway URL',
  });
  }
}
