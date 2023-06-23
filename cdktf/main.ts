import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { GoogleBetaProvider } from "./.gen/providers/google-beta/provider/index";
import { GoogleFirebaseProject } from "./.gen/providers/google-beta/google-firebase-project";
import { GoogleFirebaseWebApp } from "./.gen/providers/google-beta/google-firebase-web-app";

import { GoogleFirestoreDatabase } from "./.gen/providers/google-beta/google-firestore-database";
import { GoogleFirebaserulesRuleset } from "./.gen/providers/google-beta/google-firebaserules-ruleset";
import { GoogleFirebaserulesRelease } from "./.gen/providers/google-beta/google-firebaserules-release";

import { GoogleIdentityPlatformConfig } from "./.gen/providers/google-beta/google-identity-platform-config";
import { GoogleIdentityPlatformProjectDefaultConfig } from "./.gen/providers/google-beta/google-identity-platform-project-default-config";


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
    // new GoogleProvider(this, `provider-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, projectInfo.projectMeta);
    const googleBetaProvider = new GoogleBetaProvider(this, `beta-provider`, {
      alias: "no_user_project_override",
      userProjectOverride: true,
      region: projectInfo.projectMeta?.region,
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
      "serviceusage.googleapis.com",
      "firestore.googleapis.com",
      "firebaserules.googleapis.com",
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

    const googleIdentityPlatformConfig = new GoogleIdentityPlatformConfig(this, `identity-platform-config`, {
      project: project.name,
      provider: googleBetaProvider,
      autodeleteAnonymousUsers: true,
      dependsOn: [googleFirebaseProject],
    })

    new GoogleIdentityPlatformProjectDefaultConfig(this, `identity-platform-default-config`, {
      project: project.name,
      provider: googleBetaProvider,
      signIn: {
        allowDuplicateEmails: false,
        anonymous: {
          enabled: true
        },
        email: {
          enabled: true,
          passwordRequired: false,
        }
      },
      dependsOn: [googleIdentityPlatformConfig],
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
      locationId: projectInfo.projectMeta?.region!,
      type: "FIRESTORE_NATIVE",
      concurrencyMode: "OPTIMISTIC",
      dependsOn: [googleFirebaseProject],
    });

    const googleFirebaserulesRuleset = new GoogleFirebaserulesRuleset(this, `firebaserules-ruleset`, {
      project: project.name,
      provider: googleBetaProvider,      
      source: {
        files: [{
          name: "firestore.rules",
          content: `service cloud.firestore {
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

    new GoogleFirebaserulesRelease(this, `firebaserules-release`, {
      project: project.name,
      provider: googleBetaProvider,
      name: "firestore.rules",
      rulesetName: googleFirebaserulesRuleset.name,
      lifecycle: {
        replaceTriggeredBy: [googleFirebaserulesRuleset.name]
      },
      dependsOn: [googleFirestoreDatabase],
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
