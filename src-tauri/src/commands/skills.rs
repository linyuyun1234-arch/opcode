use anyhow::Result;
use reqwest::header::USER_AGENT;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillInfo {
    name: String,
    description: String,
    url: String, // GitHub HTML URL or API URL
}

#[derive(Debug, Deserialize)]
struct GitHubContent {
    name: String,
    path: String,
    #[serde(rename = "type")]
    content_type: String,
    html_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentTemplate {
    name: String,
    description: String,
    prompt: String,
    category: String,
}

#[command]
pub async fn fetch_available_skills() -> Result<Vec<SkillInfo>, String> {
    // 1. Fetch from anthropics/skills
    let client = reqwest::Client::new();
    let url = "https://api.github.com/repos/anthropics/skills/contents/skills";

    let response = client
        .get(url)
        .header(USER_AGENT, "Opcode-Agent")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub API Error: {}", response.status()));
    }

    let contents: Vec<GitHubContent> = response.json().await.map_err(|e| e.to_string())?;

    let mut skills = Vec::new();

    for item in contents {
        if item.content_type == "dir" {
            skills.push(SkillInfo {
                name: item.name.clone(),
                description: format!("Official Skill: {}", item.name),
                url: item.html_url,
            });
        }
    }

    Ok(skills)
}

#[command]
pub async fn fetch_mcp_marketplace() -> Result<Vec<SkillInfo>, String> {
    // 1. Try Fetch from modelcontextprotocol/servers/src
    let client = reqwest::Client::new();
    // Try 'src' first, as official repo usually puts them there
    let url = "https://api.github.com/repos/modelcontextprotocol/servers/contents/src";

    // Define Fallback List
    let fallback_servers = vec![
        SkillInfo {
            name: "filesystem".to_string(),
            description: "Read/Write local files".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem"
                .to_string(),
        },
        SkillInfo {
            name: "memory".to_string(),
            description: "Graph-based memory".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory".to_string(),
        },
        SkillInfo {
            name: "fetch".to_string(),
            description: "Fetch web content".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch".to_string(),
        },
        SkillInfo {
            name: "postgres".to_string(),
            description: "PostgreSQL Database".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres"
                .to_string(),
        },
        SkillInfo {
            name: "sqlite".to_string(),
            description: "SQLite Database".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite".to_string(),
        },
        SkillInfo {
            name: "github".to_string(),
            description: "GitHub API Integration".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/github".to_string(),
        },
        SkillInfo {
            name: "slack".to_string(),
            description: "Slack Integration".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack".to_string(),
        },
        SkillInfo {
            name: "google-drive".to_string(),
            description: "Google Drive Access".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/google-drive"
                .to_string(),
        },
    ];

    let response = client
        .get(url)
        .header(USER_AGENT, "Opcode-Agent")
        .send()
        .await;

    // Use fallback if request fails
    let response = match response {
        Ok(res) => res,
        Err(_) => return Ok(fallback_servers),
    };

    if !response.status().is_success() {
        // Fallback on HTTP error (e.g. 403 Rate Limit, 404)
        return Ok(fallback_servers);
    }

    let contents: Result<Vec<GitHubContent>, _> = response.json().await;

    match contents {
        Ok(items) => {
            let mut servers = Vec::new();
            for item in items {
                if item.content_type == "dir" {
                    servers.push(SkillInfo {
                        name: item.name.clone(),
                        description: format!("Official MCP Server: {}", item.name),
                        url: item.html_url,
                    });
                }
            }
            if servers.is_empty() {
                Ok(fallback_servers)
            } else {
                Ok(servers)
            }
        }
        Err(_) => Ok(fallback_servers),
    }
}

#[command]
pub async fn fetch_agent_templates() -> Result<Vec<AgentTemplate>, String> {
    // Hardcoded high-quality agent templates
    let templates = vec![
        AgentTemplate {
            name: "React Engineer".to_string(),
            description: "Expert in React, TypeScript, and modern frontend development.".to_string(),
            category: "Coding".to_string(),
            prompt: "You are a Senior React Engineer. You write clean, performant, and accessible code using modern React patterns (Hooks, Context). You prefer functional components and TypeScript.".to_string(),
        },
        AgentTemplate {
            name: "Python Architect".to_string(),
            description: "Specializes in Python backend systems, FastAPI, and data structures.".to_string(),
            category: "Coding".to_string(),
            prompt: "You are a Python System Architect. You design robust, scalable backend systems. You follow PEP 8 and use type hints. You are expert in FastAPI, Django, and AsyncIO.".to_string(),
        },
        AgentTemplate {
            name: "Tech Writer".to_string(),
            description: "Creates clear, concise, and technical documentation.".to_string(),
            category: "Writing".to_string(),
            prompt: "You are a Technical Writer. You create documentation that is easy to understand for developers. You use clear language, code examples, and proper formatting.".to_string(),
        },
        AgentTemplate {
            name: "Security Auditor".to_string(),
            description: "Analyzes code for vulnerabilities and security flaws.".to_string(),
            category: "Security".to_string(),
            prompt: "You are a Security Auditor. checking for OWASP Top 10 vulnerabilities, insecure dependencies, and bad practices.".to_string(),
        }
    ];
    Ok(templates)
}

#[command]
pub async fn install_skill(project_path: String, skill_name: String) -> Result<(), String> {
    // 1. Construct raw URL
    // https://raw.githubusercontent.com/anthropics/skills/main/skills/<name>/SKILL.md

    let raw_url = format!(
        "https://raw.githubusercontent.com/anthropics/skills/main/skills/{}/SKILL.md",
        skill_name
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&raw_url)
        .header(USER_AGENT, "Opcode-Agent")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download SKILL.md: {}",
            response.status()
        ));
    }

    let content = response.text().await.map_err(|e| e.to_string())?;

    // 2. Ensure .claude/skills/<name> exists
    let mut dest_path = PathBuf::from(&project_path);
    dest_path.push(".claude");
    dest_path.push("skills");
    dest_path.push(&skill_name);

    fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;

    // 3. Write SKILL.md
    dest_path.push("SKILL.md");
    fs::write(&dest_path, content).map_err(|e| e.to_string())?;

    Ok(())
}
