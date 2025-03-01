import { authSession } from '@/services/backend/auth';
import { getK8s } from '@/services/backend/kubernetes';
import { jsonRes } from '@/services/backend/response';
import { ApiResp } from '@/services/kubernet';
import { TemplateType } from '@/types/app';
import { getTemplateDataSource, handleTemplateToInstanceYaml } from '@/utils/json-yaml';
import fs from 'fs';
import yaml from 'js-yaml';
import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    const { templateName } = req.query as { templateName: string };
    let user_namespace = '';

    try {
      const { namespace } = await getK8s({
        kubeconfig: await authSession(req.headers)
      });
      user_namespace = namespace;
    } catch (error) {
      console.log(error, 'Unauthorized allowed');
    }

    const { code, message, dataSource, templateYaml, TemplateEnvs, yamlList } =
      await GetTemplateByName({
        namespace: user_namespace,
        templateName: templateName
      });

    if (code !== 20000) {
      return jsonRes(res, { code, message });
    }

    jsonRes(res, {
      code: 200,
      data: {
        source: {
          ...dataSource,
          ...TemplateEnvs
        },
        yamlList: yamlList,
        templateYaml: templateYaml
      }
    });
  } catch (err: any) {
    console.log(err);
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}

export async function GetTemplateByName({
  namespace,
  templateName
}: {
  namespace: string;
  templateName: string;
}) {
  const TemplateEnvs = {
    SEALOS_CLOUD_DOMAIN: process.env.SEALOS_CLOUD_DOMAIN || 'cloud.sealos.io',
    SEALOS_CERT_SECRET_NAME: process.env.SEALOS_CERT_SECRET_NAME || 'wildcard-cert',
    TEMPLATE_REPO_URL:
      process.env.TEMPLATE_REPO_URL || 'https://github.com/labring-actions/templates',
    SEALOS_NAMESPACE: namespace || ''
  };

  const originalPath = process.cwd();
  const targetPath = path.resolve(originalPath, 'FastDeployTemplates', 'template');

  const yamlString = fs.readFileSync(`${targetPath}/${templateName}.yaml`, 'utf-8');

  const yamlData = yaml.loadAll(yamlString);
  const templateYaml: TemplateType = yamlData.find(
    (item: any) => item.kind === 'Template'
  ) as TemplateType;
  if (!templateYaml) {
    return {
      code: 40000,
      message: 'Lack of kind template'
    };
  }
  const yamlList = yamlData.filter((item: any) => item.kind !== 'Template');
  const dataSource = getTemplateDataSource(templateYaml, TemplateEnvs);

  // Convert template to instance
  const instanceName = dataSource?.defaults?.['app_name']?.value;
  if (!instanceName) {
    return {
      code: 40000,
      message: 'default app_name is missing'
    };
  }
  const instanceYaml = handleTemplateToInstanceYaml(templateYaml, instanceName);
  yamlList.unshift(instanceYaml);

  return {
    code: 20000,
    message: 'success',
    dataSource,
    TemplateEnvs,
    yamlList,
    templateYaml
  };
}
