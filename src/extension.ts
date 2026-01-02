import {
  CancellationToken,
  DocumentLink,
  ExtensionContext,
  languages,
  Position,
  ProviderResult,
  Range,
  TextDocument,
  Uri,
} from "vscode";

const regexp =
  /(?<prefix>.*["']?Type["']?:\s*["']?)(?<resource>(?<service_provider>AWS)::(?<service_name>[A-Za-z0-9]+)::(?<data_type_name>[A-Za-z0-9]+))["']?/;
// Matches things of the form:
// - Type: AWS::Lambda::Function
// - "Type": "AWS::Lambda::Function"
// This regex works for both json, yaml, and json in yaml formats
// Not going to worry about non-aws service_providers since they will have different documentation requirements

function provideDocumentLinks(
  document: TextDocument,
  token: CancellationToken
): ProviderResult<DocumentLink[]> {
  const documentLinks: DocumentLink[] = [];

  for (let lnIdx = 0; lnIdx < document.lineCount; lnIdx++) {
    const line = document.lineAt(lnIdx);

    if (line.isEmptyOrWhitespace) {
      continue;
    }

    const match = regexp.exec(line.text);
    if (!match || !match.groups) {
      continue;
    }

    const awsResourceRange = new Range(
      new Position(lnIdx, match.groups.prefix.length),
      new Position(
        lnIdx,
        match.groups.prefix.length + match.groups.resource.length
      )
    );

    let awsDocumentationLink: Uri;

    try {
      if (match.groups.service_name === "Serverless") {
        awsDocumentationLink = Uri.parse(
          `https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-${match.groups.data_type_name.toLowerCase()}.html`
        );
      } else {
        awsDocumentationLink = Uri.parse(
          `https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-${match.groups.service_name.toLowerCase()}-${match.groups.data_type_name.toLowerCase()}.html`
        );
      }
    } catch {
      continue;
    }

    const docLink = new DocumentLink(awsResourceRange, awsDocumentationLink);

    docLink.tooltip = awsDocumentationLink.toString();

    documentLinks.push(docLink);
  }

  return documentLinks;
}

export function activate(context: ExtensionContext) {
  // Run this for yaml and json files
  // TODO: reduce document target to /(.+-)?template\.(yaml|yml|json)/ files
  // Q: Is it possible to detect language by the presence of `AWSTemplateFormatVersion: 2010-09-09`?
  const linkLanguages = ["json", "yaml"];

  for (const linkLanguage of linkLanguages) {
    context.subscriptions.push(
      languages.registerDocumentLinkProvider(linkLanguage, {
        provideDocumentLinks: provideDocumentLinks,
      })
    );
  }
}
