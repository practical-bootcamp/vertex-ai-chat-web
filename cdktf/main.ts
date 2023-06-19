import { Construct } from "constructs";
import { App, TerraformOutput, TerraformStack } from "cdktf";
import { GoogleBetaProvider } from "./.gen/providers/google-beta/provider/index";
import { GoogleFirebaseProject } from "./.gen/providers/google-beta/google-firebase-project";
import { GoogleFirebaseWebApp } from "./.gen/providers/google-beta/google-firebase-web-app";
import { DataGoogleFirebaseWebAppConfigA } from "./.gen/providers/google-beta/data-google-firebase-web-app-config";



import { GoogleProject } from "./.gen/providers/google-beta/google-project";
import { logger, readDir } from './util';
import { ProjectInfo } from "./process_object";
import { DataGoogleBillingAccount } from "./.gen/providers/google-beta/data-google-billing-account";
import { GoogleProjectService } from "./.gen/providers/google-beta/google-project-service";

class VertexAiChatAppStack extends TerraformStack {
  constructor(scope: Construct, id: string, projectInfo: ProjectInfo) {
    super(scope, id);
    // new GoogleProvider(this, `provider-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, projectInfo.projectMeta);
    // const googleBetaProvider = 
    new GoogleBetaProvider(this, `beta-provider-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, {
      alias: "no_user_project_override",
      userProjectOverride: false
    });

    const billingAccount = new DataGoogleBillingAccount(this, "billing-account", {
      billingAccount: projectInfo.projectMeta?.billingAccount,
    });

    const project = new GoogleProject(this, `project-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, {
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
    ];
    const services = [];
    for (const api of apis) {
      services.push(new GoogleProjectService(this, `${api.replaceAll(".", "")}`, {
        project: project.id,
        service: api,
        disableOnDestroy: false,
      }));
    }

    const googleFirebaseProject = new GoogleFirebaseProject(this, `firebase-project-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, {
      project: project.id,      
      // provider: googleBetaProvider,
      dependsOn: [project]
    })

    const googleFirebaseWebApp = new GoogleFirebaseWebApp(this, `firebase-web-app-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, {
      project: project.id,
      displayName: "Vertex AI Chat Firebase Web App",      
      deletionPolicy: "DELETE",
      // provider: googleBetaProvider,
      dependsOn: [googleFirebaseProject],
    })

    const googleFirebaseWebAppConfig = new DataGoogleFirebaseWebAppConfigA(this,
      `firebase-web-app-config-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`, {
      webAppId: googleFirebaseWebApp.appId,
      // provider: googleBetaProvider,
    })

    new TerraformOutput(this, "appId", {
      value: googleFirebaseWebApp.appId,
    });
    new TerraformOutput(this, "apiKey", {
      value: googleFirebaseWebAppConfig.apiKey,
    });
    new TerraformOutput(this, "authDomain", {
      value: googleFirebaseWebAppConfig.authDomain,
    });
    new TerraformOutput(this, "databaseURL", {
      value: googleFirebaseWebAppConfig.getStringAttribute("database_url"),
    });


    // define resources here
  }
}

const projectInfo = readDir('.');
logger.debug(projectInfo);
const app = new App();
new VertexAiChatAppStack(app, "cdktf", projectInfo);
app.synth();
