import {load as loadYaml } from 'js-yaml';
import { ProjectInfo } from './process_object';
import fs = require('fs');
import { resolve } from 'path';
const log4js = require("log4js");

log4js.configure({
    appenders: { projectLogger: { type: "file", filename: "typescriptL.log" } },
    categories: { default: { appenders: ["projectLogger"], level: "info" } },
  });
  
export const logger = log4js.getLogger();


export function readYamlFileSync(filePath:String): any {
    return loadYaml(fs.readFileSync(filePath,'utf-8'));
}


export function readDir(dirPath: string): ProjectInfo {
    let projectInfo: ProjectInfo = {};   
    try {
        logger.info("DirPath is : ", dirPath);
       
        fs.readdirSync(dirPath).forEach((file: string) => {
            const resolvedFilePath = resolve(dirPath, file);
            logger.info(resolvedFilePath);
            if(file.includes("project.yaml")){
                projectInfo = (<ProjectInfo> readYamlFileSync(resolvedFilePath));
            }            
        });        
        logger.info("ProjectInfo: ",projectInfo);
    } catch (error) {
        logger.error(error);        
    }
    return projectInfo;
}