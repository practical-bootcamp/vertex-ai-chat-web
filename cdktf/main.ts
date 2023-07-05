import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { GoogleBetaProvider } from "./.gen/providers/google-beta/provider/index";
import { GoogleFirebaseProject } from "./.gen/providers/google-beta/google-firebase-project";
import { GoogleProjectIamBinding } from "./.gen/providers/google-beta/google-project-iam-binding";
import { GoogleFirebaseWebApp } from "./.gen/providers/google-beta/google-firebase-web-app";
import { GoogleIdentityPlatformDefaultSupportedIdpConfig } from "./.gen/providers/google-beta/google-identity-platform-default-supported-idp-config";

import { GoogleFirestoreDatabase } from "./.gen/providers/google-beta/google-firestore-database";
import { GoogleFirebaserulesRuleset } from "./.gen/providers/google-beta/google-firebaserules-ruleset";
import { GoogleFirebaserulesRelease } from "./.gen/providers/google-beta/google-firebaserules-release";

import { GoogleIdentityPlatformConfig } from "./.gen/providers/google-beta/google-identity-platform-config";
import { GoogleIdentityPlatformProjectDefaultConfig } from "./.gen/providers/google-beta/google-identity-platform-project-default-config";
import { GoogleAppEngineApplication } from "./.gen/providers/google-beta/google-app-engine-application";
import { GoogleFirebaseStorageBucket } from "./.gen/providers/google-beta/google-firebase-storage-bucket";


import { GoogleProject } from "./.gen/providers/google-beta/google-project";
import { logger, readDir } from './util';
import { ProjectInfo } from "./process_object";
import { DataGoogleBillingAccount } from "./.gen/providers/google-beta/data-google-billing-account";
import { GoogleProjectService } from "./.gen/providers/google-beta/google-project-service";

import { GoogleProjectIamPolicy } from "./.gen/providers/google-beta/google-project-iam-policy";
import { DataGoogleIamPolicy } from "./.gen/providers/google-beta/data-google-iam-policy";



class VertexAiChatAppStack extends TerraformStack {
  constructor(scope: Construct, id: string, projectInfo: ProjectInfo) {
    super(scope, id);
    const region = projectInfo.projectMeta?.region!;

    // new GoogleProvider(this, `provider-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, projectInfo.projectMeta);
    const googleBetaProvider = new GoogleBetaProvider(this, `beta-provider`, {
      alias: "no_user_project_override",
      userProjectOverride: true,
      region: region,
    });

    const billingAccount = new DataGoogleBillingAccount(this, "billing-account", {
      billingAccount: projectInfo.projectMeta?.billingAccount,
    });

    const project = new GoogleProject(this, `project`, {
      name: projectInfo.projectMeta?.project!,
      projectId: projectInfo.projectMeta?.project!,

      billingAccount: billingAccount.id,
      skipDelete: false,
      labels: {
        "firebase": "enabled"
      }
    });

    const apis = [
      "cloudbilling.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "firebase.googleapis.com",
      "appengine.googleapis.com",
      "run.googleapis.com",
      "iam.googleapis.com",
      "cloudbuild.googleapis.com",
      "identitytoolkit.googleapis.com",
      "serviceusage.googleapis.com",
      "firestore.googleapis.com",
      "firebaserules.googleapis.com",
      "firebasestorage.googleapis.com",
      "storage.googleapis.com"
    ];
    const services = [];
    for (const api of apis) {
      services.push(new GoogleProjectService(this, `${api.replaceAll(".", "")}`, {
        project: project.id,
        service: api,
        disableOnDestroy: false,
      }));
    }

    const dataGoogleIamPolicy = new DataGoogleIamPolicy(this, `iam-policy`, {
      binding: [{ role: "roles/owner", members: [`user:cy.gdoc@gmail.com`] }]
    })

    const googleProjectIamPolicy = new GoogleProjectIamPolicy(this, `iam-project`, {
      project: project.id,
      policyData: dataGoogleIamPolicy.policyData
    });

    const googleFirebaseProject = new GoogleFirebaseProject(this, `firebase-project`, {
      project: project.name,
      provider: googleBetaProvider,
      dependsOn: [...services, project, googleProjectIamPolicy]
    })


    new GoogleProjectIamBinding(this, `project-iam-binding`, {
      project: project.name,
      members: ["serviceAccount:firebase-service-account@firebase-sa-management.iam.gserviceaccount.com"],
      role: "roles/storage.objectAdmin",
    });

    const googleIdentityPlatformConfig = new GoogleIdentityPlatformConfig(this, `identity-platform-config`, {
      project: project.name,
      provider: googleBetaProvider,
      autodeleteAnonymousUsers: true,
      dependsOn: [googleFirebaseProject],
    })

    const googleIdentityPlatformProjectDefaultConfig = new GoogleIdentityPlatformProjectDefaultConfig(this, `identity-platform-default-config`, {
      project: project.name,
      provider: googleBetaProvider,
      signIn: {
        allowDuplicateEmails: false,
        // anonymous: {
        //   enabled: true
        // },
        // email: {
        //   enabled: true,
        //   passwordRequired: false,
        // }
      },
      dependsOn: [googleIdentityPlatformConfig],
    })

    new GoogleIdentityPlatformDefaultSupportedIdpConfig(this, `identity-platform-default-supported-idp-config`, {
      project: project.name,
      provider: googleBetaProvider,
      idpId: "google.com",
      clientId: projectInfo.projectMeta?.clientId!,
      clientSecret: projectInfo.projectMeta?.clientSecret!,
      enabled: true,
      dependsOn: [googleIdentityPlatformProjectDefaultConfig],
    })

    // const googleFirebaseWebApp =     
    new GoogleFirebaseWebApp(this, `firebase-web-app`, {
      project: project.name,
      displayName: "Vertex AI Chat Firebase Web App",
      deletionPolicy: "DELETE",
      provider: googleBetaProvider,
      dependsOn: [googleFirebaseProject],
    });

    const googleFirestoreDatabase = new GoogleFirestoreDatabase(this, `firestore-database`, {
      project: project.name,
      provider: googleBetaProvider,
      name: "default",
      locationId: region,
      type: "FIRESTORE_NATIVE",
      concurrencyMode: "OPTIMISTIC",
      dependsOn: [googleFirebaseProject],
    });

    const firestoreGoogleFirebaserulesRuleset = new GoogleFirebaserulesRuleset(this, `firestore-firebaserules-ruleset`, {
      project: project.name,
      provider: googleBetaProvider,
      source: {
        files: [{
          name: "firestore.rules",
          content: `
          rules_version = "2";
          service cloud.firestore {
            match /databases/{database}/documents {
              // Messages:
              //   - Anyone can read.
              //   - Authenticated users can add and edit messages.
              //   - Validation: Check name is same as auth token and text length below 300 char or that imageUrl is a URL.
              //   - Deletes are not allowed.
              match /messages/{messageId} {
                allow read;
                allow create, update: if request.auth != null
                              && request.resource.data.name == request.auth.token.name
                              && (request.resource.data.text is string
                                && request.resource.data.text.size() <= 300
                                || request.resource.data.imageUrl is string
                                && request.resource.data.imageUrl.matches('https?://.*'));
                allow delete: if false;
              }
              // FCM Tokens:
              //   - Anyone can write their token.
              //   - Reading list of tokens is not allowed.
              match /fcmTokens/{token} {
                allow read: if false;
                allow write;
              }
            }
          }
          `
        }]
      },
      dependsOn: [googleFirestoreDatabase],
    });

    new GoogleFirebaserulesRelease(this, `firestore-firebaserules-release`, {
      project: project.name,
      provider: googleBetaProvider,
      name: "firestore.rules",
      rulesetName: firestoreGoogleFirebaserulesRuleset.name,
      lifecycle: {
        //A hack to solve keysToSnakeCase Maximum call stack size exceeded
        replaceTriggeredBy: ["google_firebaserules_ruleset.firestore-firebaserules-ruleset"]
      },
      dependsOn: [firestoreGoogleFirebaserulesRuleset],
    });

    const googleAppEngineApplication = new GoogleAppEngineApplication(this, `app-engine-application`, {
      project: project.name,
      provider: googleBetaProvider,
      locationId: region,
      databaseType: "CLOUD_FIRESTORE",
      dependsOn: [googleFirestoreDatabase],
    });

    const googleFirebaseStorageBucket = new GoogleFirebaseStorageBucket(this, `firebase-storage-bucket`, {
      project: project.name,
      provider: googleBetaProvider,
      bucketId: googleAppEngineApplication.defaultBucket,
      dependsOn: [googleFirebaseProject],
    });

    const storageGoogleFirebaserulesRuleset = new GoogleFirebaserulesRuleset(this, `storage-firebaserules-ruleset`, {
      project: project.name,
      provider: googleBetaProvider,
      source: {
        files: [{
          name: "storage.rules",
          content: `
          rules_version = "2";
          // Returns true if the uploaded file is an image and its size is below the given number of MB.
          function isImageBelowMaxSize(maxSizeMB) {
            return request.resource.size < maxSizeMB * 1024 * 1024
                && request.resource.contentType.matches('image/.*');
          }
          
          service firebase.storage {
            match /b/{bucket}/o {
              match /{userId}/{messageId}/{fileName} {
                allow write: if request.auth != null && request.auth.uid == userId && isImageBelowMaxSize(5);
                allow read;
              }
            }
          }          
          `
        }]
      },
      dependsOn: [googleFirebaseStorageBucket],
    });

    new GoogleFirebaserulesRelease(this, `storage-firebaserules-release`, {
      project: project.name,
      provider: googleBetaProvider,
      name: "firebase.storage/" + googleAppEngineApplication.defaultBucket,
      rulesetName: `projects/${project.name}/rulesets/${storageGoogleFirebaserulesRuleset.name}`,
      lifecycle: {
        //A hack to solve keysToSnakeCase Maximum call stack size exceeded
        replaceTriggeredBy: ["google_firebaserules_ruleset.firestore-firebaserules-ruleset"]
      },
      dependsOn: [storageGoogleFirebaserulesRuleset],
    });


    // const googleFirebaseWebAppConfig = new DataGoogleFirebaseWebAppConfigA(this, `firebase-web-app-config`, {
    //   webAppId: googleFirebaseWebApp.appId,
    //   provider: googleBetaProvider,
    // })

    // new TerraformOutput(this, "appId", {
    //   value: googleFirebaseWebApp.appId,
    // });
    // new TerraformOutput(this, "apiKey", {
    //   value: googleFirebaseWebAppConfig.apiKey,
    // });
    // new TerraformOutput(this, "authDomain", {
    //   value: googleFirebaseWebAppConfig.authDomain,
    // });
    // new TerraformOutput(this, "databaseURL", {
    //   value: googleFirebaseWebAppConfig.getStringAttribute("database_url"),
    // });
  }
}

const projectInfo = readDir('.');
logger.debug(projectInfo);
const app = new App();
new VertexAiChatAppStack(app, "cdktf", projectInfo);
app.synth();
