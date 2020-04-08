#!/usr/bin/env node

// Usage:
// yarn create grandstack-app mynewapp

// inspired by create-redwood-app

import fs from "fs";
import path from "path";
import decompress from "decompress";
import axios from "axios";
import Listr from "listr";
import execa from "execa";
import tmp from "tmp";
import checkNodeVersion from "check-node-version";
import chalk from "chalk";
import { Command } from "commander";

let projectName;

const program = new Command()
  .arguments("<project-directory>")
  .action((name) => {
    projectName = name;
  })
  .option("--use-npm")

  .parse(process.argv);

const shouldUseYarn = () => {
  try {
    execa.sync("yarnpkg", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
};

const useYarn = program.useNpm ? false : shouldUseYarn();

const RELEASE_URL =
  "https://api.github.com/repos/grand-stack/grand-stack-starter/releases";

const latestReleaseZipFile = async () => {
  const res = await axios.get(RELEASE_URL);
  return res.data[0].zipball_url;
};

const downloadFile = async (sourceUrl, targetFile) => {
  const writer = fs.createWriteStream(targetFile);
  const response = await axios.get(sourceUrl, {
    responseType: "stream",
  });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const targetDir = projectName.replace(/,/g, "-");
if (!targetDir) {
  console.error("No project directory specified");
  console.log(
    `${chalk.cyan("yarn create grandstack-app")} ${chalk.green(
      "<project-directory>"
    )}`
  );
  console.log();
  console.log("For example:");
  console.log(
    `${chalk.cyan("yarn create grandstack-app")} ${chalk.green(
      "my-grandstack-app"
    )}`
  );
  process.exit(1);
}

const newAppDir = path.resolve(process.cwd(), targetDir);
const appDirExists = fs.existsSync(newAppDir);

if (appDirExists && fs.readdirSync(newAppDir).length > 0) {
  console.error(`'${newAppDir}' already exists and is not empty.`);
  process.exit(1);
}

const createProjectTasks = ({ newAppDir }) => {
  const tmpDownloadPath = tmp.tmpNameSync({
    prefix: "grandstack",
    postfix: ".zip",
  });

  return [
    {
      title: `${appDirExists ? "Using" : "Creating"} directory '${newAppDir}'`,
      task: () => {
        fs.mkdirSync(newAppDir, { recursive: true });
      },
    },
    {
      title: "Downloading latest release",
      task: async () => {
        const url = await latestReleaseZipFile();
        return downloadFile(url, tmpDownloadPath);
      },
    },

    {
      title: "Extracting latest release",
      task: () => decompress(tmpDownloadPath, newAppDir, { strip: 1 }),
    },
  ];
};

const installNodeModulesTasks = ({ newAppDir }) => {
  return [
    {
      title: "Checking compatibility",
      task: () => {
        return new Promise((resolve, reject) => {
          // FIXME: pull this from grand-stack-starter repo
          const engines = {
            node: ">=8",
          };

          checkNodeVersion(engines, (_error, result) => {
            if (result.isSatisfied) {
              return resolve();
            }

            const errors = Object.keys(result.versions).map((name) => {
              const { version, wanted } = result.versions[name];
              return `${name} ${wanted} required, but found ${version}`;
            });
            return reject(new Error(errors.join("\n")));
          });
        });
      },
    },
    {
      title: "Installing dependencies for 'api'",
      task: () => {
        return execa(useYarn ? "yarn install" : "npm install", {
          shell: true,
          cwd: path.join(newAppDir, "api"),
        });
      },
    },
    {
      title: "Installing dependencies for 'ui-react'",
      task: () => {
        return execa(useYarn ? "yarn install" : "npm install", {
          shell: true,
          cwd: path.join(newAppDir, "ui-react"),
        });
      },
    },
  ];
};

new Listr(
  [
    {
      title: "Create GRANDstack App",
      task: () => new Listr(createProjectTasks({ newAppDir })),
    },
    {
      title: "Installing Packages",
      task: () => new Listr(installNodeModulesTasks({ newAppDir })),
    },
  ],
  { collapse: false, exitOnError: true }
)
  .run()
  .then(() => {
    console.log();
    console.log(
      `Thanks for trying out GRANDstack! We've created your app in '${newAppDir}'`
    );
    console.log(`You can find documentation at: https://grandstack.io/docs`);
    console.log();
  })
  .catch((e) => {
    console.log();
    console.log(e);
    process.exit(1);
  });
