import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { provider } from "@cdktf/provider-google";
import { logger, readDir } from './util';
import { ProjectInfo } from "./process_object";

class VertexAiChatAppStack extends TerraformStack {
  constructor(scope: Construct, id: string, projectInfo: ProjectInfo) {
    super(scope, id);
    new provider.GoogleProvider(this, `provider-${projectInfo.projectMeta?.project}-${projectInfo.projectMeta?.region}`,  projectInfo.projectMeta);

    // define resources here
  }
}

const projectInfo = readDir('.');
logger.debug(projectInfo);
const app = new App();
new VertexAiChatAppStack(app, "cdktf",projectInfo);
app.synth();
